-- ============================================================
-- 20260901_wine_merge.sql 部分適用の修復migration
--
-- 本番Supabaseの調査の結果、20260901_wine_merge.sqlは
-- 部分的にしか適用されていないことが判明した。
--
-- 存在する（本番）：
--   - public.wine_merge_log（列も既存のまま一致）
--   - policy "wine_merge_log_select_own_company"（RLS enabled）
--   - public.merge_wines()（ただし旧実装＝統合元wineをDELETEする方式）
--
-- 存在しない（本番）：
--   - wines.is_active
--   - wines.merged_into_wine_id
--   - public.wine_name_aliases
--   - public.wine_alias_key()
--
-- このファイルは 20260901_wine_merge.sql を再実行するものではない。
-- 不足しているオブジェクトだけを安全に補完し、
-- 既存の wine_merge_log（テーブル・列・RLS・policy）には一切触れない。
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- 重要：このファイルはまだ適用しないでください
-- （ユーザーの明示確認後に適用）。
--
-- このファイル（＝このDDLをapplyする行為）自体は以下を一切行わない：
--   - wines / stock_movements / purchase_items / wine_list_settings /
--     wine_classification_memoryの既存行のDELETE・UPDATE
--   - wine_merge_log のDELETE・ALTER・policy再作成
--   - 既存table/column/policyのDROP
--   - merge_wines()の実行（呼び出し）
--   - 実データのワイン統合
--   - 既存在庫数量に影響する処理
--
-- 注意：上記はあくまで「このmigrationを適用する」こと自体の影響範囲。
-- ここで(re)定義するmerge_wines()関数の本体には、運営者が実際に
-- RPCを呼び出した場合にのみ実行される
-- stock_movements/purchase_items/wine_list_settings/
-- wine_classification_memoryへのUPDATE/DELETEが含まれる
-- （これは20260901_wine_merge.sqlの本番稼働中の既存挙動と同じ）。
--
-- 2026-09-06追記：本番の現行merge_wines()（DELETE方式）が持つ
-- wine_list_settings / wine_classification_memory の
-- 「source専用なら移動・両方にあれば競合解決後にsource側を削除」
-- というロジックを、soft merge版へ移植した。wine_list_viewが
-- inventory_view / wine_list_settings / wine_classification_memory を
-- INNER JOINしているため、Master側にこの2テーブルの行が
-- 無いままだとMasterごとwine_list_viewから消えてしまうことを防ぐため。
-- ============================================================

-- ------------------------------------------------------------
-- 0. 依存extension（wine_alias_key()がunaccent()を使うため）。
--    既に存在していても安全（冪等）。
-- ------------------------------------------------------------
create extension if not exists unaccent;


-- ------------------------------------------------------------
-- 1. wines: 不足している2列を追加。
--
-- 既存データはUPDATEしない。ADD COLUMN ... DEFAULT true により、
-- 既存行はすべて自動的に is_active = true / merged_into_wine_id = null
-- となる（Postgres 11以降、定数defaultはメタデータのみの変更で
-- 適用され、テーブル書き換えは発生しない）。
-- ------------------------------------------------------------
alter table public.wines
  add column if not exists is_active boolean not null default true;

alter table public.wines
  add column if not exists merged_into_wine_id uuid;

comment on column public.wines.is_active is
  '統合により無効化された場合はfalse。既存クエリはこのカラムを意識していないため、統合後も表示され続けないよう呼び出し側でis_active=trueを条件に加える必要がある。';

comment on column public.wines.merged_into_wine_id is
  '統合先（Master）のwines.id。is_active=falseのときのみ意味を持つ。';

-- merged_into_wine_id → wines(id) のFKを、存在しない場合だけ追加する。
-- FK名を明示し、pg_constraintで既存チェックしてから追加することで
-- 再実行時の二重作成エラーを防ぐ。
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wines_merged_into_wine_id_fkey'
      and conrelid = 'public.wines'::regclass
  ) then
    alter table public.wines
      add constraint wines_merged_into_wine_id_fkey
      foreign key (merged_into_wine_id)
      references public.wines(id);
  end if;
end;
$$;


-- ------------------------------------------------------------
-- 2. wine_name_aliases: 20260901_wine_merge.sqlと同一schemaで作成。
--    既存の wine_merge_log には一切触れない。
-- ------------------------------------------------------------
create table if not exists public.wine_name_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  wine_id uuid not null references public.wines(id), -- Master
  source_key text not null,
  raw_wine_name_sample text,
  created_at timestamptz not null default now(),
  unique (company_id, source_key)
);

alter table public.wine_name_aliases
  enable row level security;

-- policyは「存在しない場合だけ」作成する（pg_policiesで事前確認）。
-- 再実行してもエラーにならないようにするため。
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_name_aliases'
      and policyname = 'wine_name_aliases_select_own_company'
  ) then
    create policy "wine_name_aliases_select_own_company"
      on public.wine_name_aliases for select
      using (
        company_id in (
          select company_id from public.profiles where id = auth.uid()
        )
      );
  end if;
end;
$$;


-- ------------------------------------------------------------
-- 3. wine_alias_key(): 20260901_wine_merge.sqlの最新版をそのまま作成。
--    純粋関数（データ書き込みなし）。create or replaceなので
--    再実行しても安全。
-- ------------------------------------------------------------
create or replace function public.wine_alias_key(
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
-- 4. merge_wines(): 本番は旧実装（統合元wineをDELETEする方式）。
--
--    以下は「本番merge_wines()の既存ロジック
--    （auth.uid()確認／company所有権確認／FOR UPDATE／
--      purchase_items・stock_movementsの付け替え／
--      wine_list_settings・wine_classification_memoryの
--      移動または競合解決後削除／統合前後数量検証／
--      wine_merge_log記録）」をすべて維持したうえで、
--    最後のwines行のDELETEだけを、is_active=false +
--    merged_into_wine_id=Masterへ設定するsoft mergeへ
--    置き換えたものである。設計自体を新規に作り直しては
--    いない（本番の挙動をsoft merge化しただけ）。
--
--    確認済み：ユーザーが本番pg_procで確認した結果、
--    本番merge_wines()の引数シグネチャ（16引数、名前・型・順序）は
--    下記CREATE OR REPLACEの引数リストと完全一致している。
--    そのためこのCREATE OR REPLACEは既存関数を正しく置き換え、
--    overload（同名別関数）は増えない。
-- ------------------------------------------------------------
do $$
declare
  v_existing record;
begin
  for v_existing in
    select
      p.oid,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'merge_wines'
  loop
    raise notice
      'Existing public.merge_wines() signature found before replace: merge_wines(%)',
      v_existing.args;
  end loop;
end;
$$;

create or replace function public.merge_wines(
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
  qty_from_before numeric,
  qty_to_before numeric,
  qty_to_after numeric,
  qty_ok boolean,
  from_wine_id uuid,
  to_wine_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from wines%rowtype;
  v_to wines%rowtype;
  v_qty_from_before numeric;
  v_qty_to_before numeric;
  v_qty_to_after numeric;
  v_alias_key text;
  v_user_id uuid := auth.uid();
  v_to_has_settings boolean;
  v_from_has_settings boolean;
  v_to_has_classification boolean;
  v_from_has_classification boolean;
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

  /*
   * 価格・掲載状態（wine_list_settings）。
   *
   * wine_list_viewは inventory_view を wine_list_settings と
   * wine_classification_memory へ INNER JOIN しているため、
   * Master側にwine_list_settings行が無いままだと、Master自体が
   * 顧客向けワインリストに表示されなくなってしまう。
   * そのためsource側にしか設定が無い場合は、削除せずMasterへ
   * 移動する（本番の既存挙動を踏襲）。
   */
  select exists (
    select 1 from wine_list_settings
    where company_id = p_company_id and wine_id = p_to_wine_id
  ) into v_to_has_settings;

  select exists (
    select 1 from wine_list_settings
    where company_id = p_company_id and wine_id = p_from_wine_id
  ) into v_from_has_settings;

  if v_from_has_settings and not v_to_has_settings then
    -- Masterに設定が無く、sourceにだけある → sourceの行をMasterへ移動する。
    update wine_list_settings
      set
        wine_id = p_to_wine_id,
        updated_at = now()
      where company_id = p_company_id
        and wine_id = p_from_wine_id;
  elsif v_from_has_settings and v_to_has_settings then
    -- 両方にある → 解決済みの値は下記でMaster側へ反映するので、
    -- source側の行は不要になる（重複を残さないよう削除する）。
    delete from wine_list_settings
      where company_id = p_company_id
        and wine_id = p_from_wine_id;
  end if;

  -- 解決済みの価格・掲載状態をMaster側へ反映する（NULLを渡した項目は変更しない）。
  update wine_list_settings
    set
      sale_price = coalesce(p_resolved_sale_price, sale_price),
      manual_price = coalesce(p_resolved_manual_price, manual_price),
      is_listed = coalesce(p_resolved_is_listed, is_listed),
      updated_at = now()
    where wine_id = p_to_wine_id and company_id = p_company_id;

  /*
   * 地理分類（wine_classification_memory）。
   *
   * こちらもwine_list_viewにINNER JOINされているため、
   * wine_list_settingsと同様に、Masterに分類行が無く
   * sourceにだけある場合はMasterへ移動する。
   * 両方にある場合は、下記の解決済み値の反映後に
   * source側の行を削除する。
   *
   * (company_id, wine_id)のユニーク制約の有無が不明なため、
   * ON CONFLICTには頼らず既存行の有無を明示的に確認する。
   */
  select exists (
    select 1 from wine_classification_memory
    where company_id = p_company_id and wine_id = p_to_wine_id
  ) into v_to_has_classification;

  select exists (
    select 1 from wine_classification_memory
    where company_id = p_company_id and wine_id = p_from_wine_id
  ) into v_from_has_classification;

  if v_from_has_classification and not v_to_has_classification then
    -- Masterに分類が無く、sourceにだけある → sourceの行をMasterへ移動する。
    update wine_classification_memory
      set
        wine_id = p_to_wine_id,
        updated_at = now()
      where company_id = p_company_id
        and wine_id = p_from_wine_id;
  elsif v_from_has_classification and v_to_has_classification then
    -- 両方にある → 解決済みの値は下記でMaster側へ反映する
    -- （p_resolved_appellationがnullの場合は何も更新しないが、
    --   その場合でもsource側の重複行は削除しておく）。
    delete from wine_classification_memory
      where company_id = p_company_id
        and wine_id = p_from_wine_id;
  end if;

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

  -- 統合元をソフト削除（DELETEしない）
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
    v_qty_from_before,
    v_qty_to_before,
    v_qty_to_after,
    (v_qty_to_after = v_qty_from_before + v_qty_to_before),
    p_from_wine_id,
    p_to_wine_id;
end;
$$;

-- 呼び出しは認証済みユーザーのみ許可（company_id不一致は関数内チェックで拒否される）
revoke all on function public.merge_wines from public;
grant execute on function public.merge_wines to authenticated;


notify pgrst, 'reload schema';
