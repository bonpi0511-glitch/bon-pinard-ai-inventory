-- ============================================================
-- ワイン統合（重複マージ）機能 - スキーマ + アトミックRPC
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- このファイル単体では既存データを一切変更しません。
-- 実際にワインを統合するのは、この後クライアント側から
-- merge_wines() をRPC呼び出ししたときだけです。
-- ============================================================

-- アクセント除去（normalizeDuplicateKeyText と同じ正規化をSQL側でも行うために使用）
create extension if not exists unaccent;

-- ------------------------------------------------------------
-- 1. wines: ソフト削除用カラム
-- ------------------------------------------------------------
alter table wines
  add column if not exists is_active boolean not null default true,
  add column if not exists merged_into_wine_id uuid references wines(id);

comment on column wines.is_active is
  '統合により無効化された場合はfalse。既存クエリはこのカラムを意識していないため、統合後も表示され続けないよう呼び出し側でis_active=trueを条件に加える必要がある。';

comment on column wines.merged_into_wine_id is
  '統合先（Master）のwines.id。is_active=falseのときのみ意味を持つ。';

-- ------------------------------------------------------------
-- 2. 統合履歴（監査ログ）
-- ------------------------------------------------------------
create table if not exists wine_merge_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  from_wine_id uuid not null,
  to_wine_id uuid not null,
  reason text not null default 'duplicate',
  similarity numeric,
  qty_from_before integer,
  qty_to_before integer,
  qty_to_after integer,
  merged_by uuid references auth.users(id),
  merged_at timestamptz not null default now(),
  notes text
);

alter table wine_merge_log enable row level security;

create policy "wine_merge_log_select_own_company"
  on wine_merge_log for select
  using (
    company_id in (
      select company_id from profiles where id = auth.uid()
    )
  );

-- insertはmerge_wines()内（security definer）からのみ行うため、
-- 一般ユーザー向けのinsertポリシーは意図的に作らない。

-- ------------------------------------------------------------
-- 3. 別名辞書（同じワインの再発防止）
-- ------------------------------------------------------------
create table if not exists wine_name_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  wine_id uuid not null references wines(id), -- Master
  source_key text not null,
  raw_wine_name_sample text,
  created_at timestamptz not null default now(),
  unique (company_id, source_key)
);

alter table wine_name_aliases enable row level security;

create policy "wine_name_aliases_select_own_company"
  on wine_name_aliases for select
  using (
    company_id in (
      select company_id from profiles where id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. 正規化関数
--
-- app/inventory-app.tsx の normalizeDuplicateKeyText /
-- wineKey() と同じ考え方（アクセント除去→大文字化→
-- 英数字以外を空白化→空白圧縮）をSQL側でも再現する。
-- alias検索キーの生成に使う。
-- ------------------------------------------------------------
create or replace function wine_alias_key(
  p_producer text,
  p_wine_name text,
  p_vintage text,
  p_bottle_size_cl integer
) returns text
language sql
immutable
as $$
  select
    trim(regexp_replace(
      upper(unaccent(coalesce(p_producer, '') || ' ' || coalesce(p_wine_name, ''))),
      '[^A-Z0-9]+', ' ', 'g'
    ))
    || ' | ' || coalesce(trim(p_vintage), '')
    || ' | ' || coalesce(p_bottle_size_cl::text, '75');
$$;

-- ------------------------------------------------------------
-- 5. マージ本体（アトミックRPC）
--
-- 呼び出し側（クライアント）が事前に、
--   - Masterとして残す側 (p_to_wine_id)
--   - 統合されて無効化される側 (p_from_wine_id)
--   - 価格・掲載状態・地理分類の「解決済みの最終値」
-- を決めてから1回だけ呼び出す。
--
-- ここでは「どちらの値を残すか」の判断はしない
-- （それはクライアント側の役割）。あくまで
-- 決定済みの値を元に、複数テーブルへの反映を
-- 1トランザクションでアトミックに行うことだけが役割。
-- ------------------------------------------------------------
create or replace function merge_wines(
  p_company_id uuid,
  p_from_wine_id uuid,
  p_to_wine_id uuid,
  p_reason text default 'duplicate',
  p_similarity numeric default null,

  -- 価格・掲載（NULLを渡した項目は変更しない）
  p_resolved_sale_price numeric default null,
  p_resolved_manual_price boolean default null,
  p_resolved_is_listed boolean default null,

  -- 地理分類（NULLを渡した場合はwine_classification_memoryを更新しない）
  p_resolved_country text default null,
  p_resolved_region text default null,
  p_resolved_subregion text default null,
  p_resolved_appellation text default null,
  p_resolved_climat text default null,
  p_resolved_cru_level text default null,
  p_resolved_category text default null,
  p_resolved_notes text default null
) returns table (
  from_wine_id uuid,
  to_wine_id uuid,
  qty_from_before integer,
  qty_to_before integer,
  qty_to_after integer,
  qty_ok boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from wines%rowtype;
  v_to wines%rowtype;
  v_qty_from_before integer;
  v_qty_to_before integer;
  v_qty_to_after integer;
  v_alias_key text;
  v_user_id uuid := auth.uid();
begin
  if p_from_wine_id = p_to_wine_id then
    raise exception 'from_wine_id と to_wine_id が同じです。統合できません。';
  end if;

  select * into v_from from wines
    where id = p_from_wine_id and company_id = p_company_id
    for update;

  if not found then
    raise exception '統合元のワインが見つかりません（company不一致の可能性）。';
  end if;

  select * into v_to from wines
    where id = p_to_wine_id and company_id = p_company_id
    for update;

  if not found then
    raise exception '統合先（Master）のワインが見つかりません（company不一致の可能性）。';
  end if;

  if not v_from.is_active then
    raise exception '統合元のワインはすでに別のワインへ統合済みです。';
  end if;

  if not v_to.is_active then
    raise exception '統合先のワインはすでに別のワインへ統合済みです。Masterには使えません。';
  end if;

  -- 統合前の在庫数を記録（inventory_viewの集計ロジックをそのまま利用）
  select coalesce(current_quantity, 0) into v_qty_from_before
    from inventory_view where wine_id = p_from_wine_id and company_id = p_company_id;

  select coalesce(current_quantity, 0) into v_qty_to_before
    from inventory_view where wine_id = p_to_wine_id and company_id = p_company_id;

  v_qty_from_before := coalesce(v_qty_from_before, 0);
  v_qty_to_before := coalesce(v_qty_to_before, 0);

  -- 履歴をMasterへ付け替え（数量は直接足さず、元データを移す）
  update purchase_items
    set wine_id = p_to_wine_id
    where wine_id = p_from_wine_id and company_id = p_company_id;

  update stock_movements
    set wine_id = p_to_wine_id
    where wine_id = p_from_wine_id and company_id = p_company_id;

  -- 価格・掲載状態（wine_list_settingsに保存されている。解決済みの値のみ反映）
  update wine_list_settings
    set
      sale_price = coalesce(p_resolved_sale_price, sale_price),
      manual_price = coalesce(p_resolved_manual_price, manual_price),
      is_listed = coalesce(p_resolved_is_listed, is_listed),
      updated_at = now()
    where wine_id = p_to_wine_id and company_id = p_company_id;

  -- 地理分類（appellationが渡された場合のみ更新）
  -- (company_id, wine_id)のユニーク制約の有無が不明なため、
  -- ON CONFLICTには頼らず既存行の有無を明示的に確認する。
  if p_resolved_appellation is not null then
    if exists (
      select 1 from wine_classification_memory
      where company_id = p_company_id and wine_id = p_to_wine_id
    ) then
      update wine_classification_memory
        set
          country = p_resolved_country,
          region = p_resolved_region,
          subregion = p_resolved_subregion,
          appellation = p_resolved_appellation,
          climat = p_resolved_climat,
          cru_level = p_resolved_cru_level,
          category = p_resolved_category,
          notes = coalesce(p_resolved_notes, notes),
          classification_source = 'MERGE_RESOLVED',
          manual_corrected = true,
          is_confirmed = true,
          confirmed_by = v_user_id,
          confirmed_at = now(),
          updated_at = now()
        where company_id = p_company_id and wine_id = p_to_wine_id;
    else
      insert into wine_classification_memory (
        company_id, wine_id,
        source_producer, source_wine_name, source_cuvee, source_vintage, source_key,
        country, region, subregion, appellation, climat, cru_level, category,
        confidence, notes,
        classification_source, manual_corrected, is_confirmed,
        confirmed_by, confirmed_at, updated_at
      )
      values (
        p_company_id, p_to_wine_id,
        v_to.producer, v_to.wine_name, v_to.cuvee, v_to.vintage,
        wine_alias_key(v_to.producer, v_to.wine_name, v_to.vintage, v_to.bottle_size_cl),
        p_resolved_country, p_resolved_region, p_resolved_subregion,
        p_resolved_appellation, p_resolved_climat, p_resolved_cru_level, p_resolved_category,
        1.0, coalesce(p_resolved_notes, ''),
        'MERGE_RESOLVED', true, true,
        v_user_id, now(), now()
      );
    end if;
  end if;

  -- 統合元をソフト削除
  -- (wines.updated_atの存在が未確認のため、ここでは更新しない)
  update wines
    set is_active = false,
        merged_into_wine_id = p_to_wine_id
    where id = p_from_wine_id and company_id = p_company_id;

  -- 別名辞書へ記録（次に同じ表記の伝票が来たら新規wine_idを作らずMasterへ紐付ける）
  v_alias_key := wine_alias_key(v_from.producer, v_from.wine_name, v_from.vintage, v_from.bottle_size_cl);

  insert into wine_name_aliases (company_id, wine_id, source_key, raw_wine_name_sample)
  values (p_company_id, p_to_wine_id, v_alias_key, v_from.wine_name)
  on conflict (company_id, source_key) do update set
    wine_id = excluded.wine_id,
    raw_wine_name_sample = excluded.raw_wine_name_sample;

  -- 統合後の在庫数を検証
  select coalesce(current_quantity, 0) into v_qty_to_after
    from inventory_view where wine_id = p_to_wine_id and company_id = p_company_id;

  v_qty_to_after := coalesce(v_qty_to_after, 0);

  insert into wine_merge_log (
    company_id, from_wine_id, to_wine_id, reason, similarity,
    qty_from_before, qty_to_before, qty_to_after,
    merged_by
  )
  values (
    p_company_id, p_from_wine_id, p_to_wine_id, p_reason, p_similarity,
    v_qty_from_before, v_qty_to_before, v_qty_to_after,
    v_user_id
  );

  return query select
    p_from_wine_id,
    p_to_wine_id,
    v_qty_from_before,
    v_qty_to_before,
    v_qty_to_after,
    (v_qty_to_after = v_qty_from_before + v_qty_to_before);
end;
$$;

-- 呼び出しは認証済みユーザーのみ許可（company_id不一致は関数内チェックで拒否される）
revoke all on function merge_wines from public;
grant execute on function merge_wines to authenticated;
