-- ============================================================
-- Section 14「顧客ユーザー権限管理」- role列の安全な活用
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- 重要：このファイルはまだ適用しないでください
-- （ユーザーの明示確認後に適用）。
--
-- 前提（2026-09-08 本番確認済み）：
--   profiles.role text NOT NULL DEFAULT 'staff'
--   分布: BON PINARD SAS = admin×1 / TEST - CUSTOMER ADMIN = staff×2
--   current_company_id(): security definer stable,
--     select company_id from profiles where id = auth.uid() limit 1
--   wines / stock_movements / purchase_invoices / purchase_items:
--     ALL authenticated, company_id = current_company_id()
--   wine_classification_memory / wine_list_settings: ALL, company scope
--   wine_list_display_settings: SELECT/INSERT/UPDATE, company scope
--   role判定は現在一切なし。
--
-- 運営者Admin（ADMIN_EMAILS + requireAdminUser()）は本ファイルで
-- 一切変更しない別概念。profiles.role='admin'は今回'owner'へ
-- 移行するが、これは「顧客company内の権限」の話であり、
-- Section 10/11/12へのアクセス可否とは無関係（Section 10/11/12は
-- 引き続きADMIN_EMAILSのみで判定される）。
-- ============================================================


-- ------------------------------------------------------------
-- 1. profiles.role: admin → owner 移行 + CHECK制約
--
-- precondition: 現在のroleが 'admin' か 'staff' 以外に
-- 1件でも存在すればmigration全体を失敗させる
-- （2026-09-08確認時点で admin×1 / staff×2 のみであることを
-- 前提にした安全策）。
-- ------------------------------------------------------------
do $$
declare
  v_bad_count integer;
begin
  select count(*) into v_bad_count
  from public.profiles
  where role not in ('admin', 'staff');

  if v_bad_count > 0 then
    raise exception
      'profiles.role contains % row(s) with a value other than admin/staff. Aborting migration to avoid an unsafe role mapping.',
      v_bad_count;
  end if;

  update public.profiles
    set role = 'owner'
    where role = 'admin';
end;
$$;

-- CHECK制約は既存行の移行が完了した後に追加する。
-- 既存のDEFAULT 'staff'は変更しない。
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('owner', 'staff', 'viewer'));
  end if;
end;
$$;

comment on column public.profiles.role is
  '顧客company内の権限: owner(管理責任者) / staff(通常業務) / viewer(閲覧のみ)。運営者Admin(ADMIN_EMAILS)とは別概念で、Section 10/11/12へのアクセス可否には一切使用しない。role変更は運営Admin APIのみが行い、一般顧客は自分自身を含めprofiles.roleを直接変更できない。';


-- ------------------------------------------------------------
-- 2. current_user_role()
--
-- current_company_id()と同じ設計パターン
-- （security definer / stable / search_path固定）で、
-- 呼び出したユーザー自身のroleだけを返す。
-- ------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

comment on function public.current_user_role() is
  '呼び出し中のSupabase Authユーザー自身のprofiles.roleを返す。RLS policy内でowner/staff限定の書き込み判定に使う。current_company_id()と同じ設計（security definer/stable）。';

revoke all
  on function public.current_user_role()
  from public, anon;

grant execute
  on function public.current_user_role()
  to authenticated;


-- ------------------------------------------------------------
-- 3. RLS再構成: company分離のみのALL policyを
--    「SELECTは全role / 書き込みはowner・staffのみ」へ分割する。
--
-- 対象テーブルの既存policy名は本番環境の設定であり、
-- このリポジトリのmigrationには定義が無いため名前を特定できない。
-- そのため、各テーブルの既存policyを名前に依存せず
-- pg_policiesから動的に列挙してDROPしてから、新しいSELECT/INSERT/
-- UPDATE policyを作成する。
--
-- 各テーブルへ付与するのはRLS(row単位)の再構成のみで、
-- テーブルへのGRANT（INSERT/UPDATE等の実行権限そのもの）は
-- 既存のまま変更しない（authenticatedは既にGRANT済みという前提）。
--
-- DELETEは、既存アプリコードがそのテーブルへ直接DELETEしていない
-- 場合は新しいDELETE policyを作らない（最小権限。RLSはデフォルト
-- 拒否のため、policyが無ければownerであってもDELETE不可のまま）。
-- ------------------------------------------------------------
do $$
declare
  v_table text;
  v_policy record;
  v_tables text[] := array[
    'wines',
    'stock_movements',
    'purchase_invoices',
    'purchase_items',
    'wine_classification_memory',
    'wine_list_settings',
    'wine_list_display_settings'
  ];
begin
  foreach v_table in array v_tables loop
    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table
    loop
      execute format(
        'drop policy %I on public.%I',
        v_policy.policyname,
        v_table
      );
    end loop;
  end loop;
end;
$$;

-- wines: SELECT全role、INSERT/UPDATEはowner/staffのみ。
-- DELETEは既存アプリが直接DELETEしない(soft merge設計)ため付与しない。
create policy "wines_select_company"
  on public.wines
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "wines_insert_company_role"
  on public.wines
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

create policy "wines_update_company_role"
  on public.wines
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

-- stock_movements: SELECT全role(Section 9履歴閲覧含む)、
-- INSERTのみowner/staff（PURCHASE/SALE/ADJUSTMENT/REVERSAL全てINSERT方式）。
-- 既存アプリはUPDATE/DELETEを一切行わないため、そのpolicyは作らない。
create policy "stock_movements_select_company"
  on public.stock_movements
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "stock_movements_insert_company_role"
  on public.stock_movements
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

-- purchase_invoices: SELECT全role、INSERTはowner/staffのみ。
create policy "purchase_invoices_select_company"
  on public.purchase_invoices
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "purchase_invoices_insert_company_role"
  on public.purchase_invoices
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

-- purchase_items: SELECT全role、INSERTはowner/staffのみ。
create policy "purchase_items_select_company"
  on public.purchase_items
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "purchase_items_insert_company_role"
  on public.purchase_items
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

-- wine_classification_memory: SELECT全role、
-- INSERT/UPDATEはowner/staffのみ（AI一括保存・手動編集の両方をカバー）。
create policy "wine_classification_memory_select_company"
  on public.wine_classification_memory
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "wine_classification_memory_insert_company_role"
  on public.wine_classification_memory
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

create policy "wine_classification_memory_update_company_role"
  on public.wine_classification_memory
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

-- wine_list_settings: SELECT全role（顧客向けワインリスト表示に必要）、
-- UPDATEのみowner/staff（価格編集・掲載ON/OFF）。
-- 既存アプリはこのテーブルへ直接INSERTしないため、そのpolicyは作らない。
create policy "wine_list_settings_select_company"
  on public.wine_list_settings
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "wine_list_settings_update_company_role"
  on public.wine_list_settings
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

-- wine_list_display_settings: SELECT全role、
-- INSERT/UPDATEはowner/staffのみ（レイアウト設定のupsert）。
create policy "wine_list_display_settings_select_company"
  on public.wine_list_display_settings
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "wine_list_display_settings_insert_company_role"
  on public.wine_list_display_settings
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );

create policy "wine_list_display_settings_update_company_role"
  on public.wine_list_display_settings
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('owner', 'staff')
  );


-- ------------------------------------------------------------
-- 4. wine_duplicate_decisions: 既存policy名が判明しているため
--    (20260901194700_create_wine_duplicate_decisions.sql)、
--    INSERT/DELETE policyだけを名前指定でDROP→再作成する。
--    SELECT policyは変更しない（重複候補の閲覧は全roleに許可のまま）。
--    既存のdecided_by/wine所有権チェックはそのまま維持し、
--    role条件だけを追加する。
-- ------------------------------------------------------------
drop policy if exists
  "wine_duplicate_decisions_insert_company"
  on public.wine_duplicate_decisions;

create policy
  "wine_duplicate_decisions_insert_company"
  on public.wine_duplicate_decisions
  for insert
  to authenticated
  with check (
    decided_by = auth.uid()

    and public.current_user_role() in ('owner', 'staff')

    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id =
          wine_duplicate_decisions.company_id
    )

    and exists (
      select 1
      from public.wines w
      where w.id =
          wine_duplicate_decisions.wine_id_a
        and w.company_id =
          wine_duplicate_decisions.company_id
    )

    and exists (
      select 1
      from public.wines w
      where w.id =
          wine_duplicate_decisions.wine_id_b
        and w.company_id =
          wine_duplicate_decisions.company_id
    )
  );

drop policy if exists
  "wine_duplicate_decisions_delete_company"
  on public.wine_duplicate_decisions;

create policy
  "wine_duplicate_decisions_delete_company"
  on public.wine_duplicate_decisions
  for delete
  to authenticated
  using (
    public.current_user_role() in ('owner', 'staff')

    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id =
          wine_duplicate_decisions.company_id
    )
  );

-- wine_name_aliases / wine_merge_log: 現状SELECT policyしか
-- 存在せず、authenticated向けのINSERT/UPDATE/DELETE policyは
-- 元から無い（merge_wines()内のsecurity definer処理からのみ
-- 書き込まれる設計）。viewerが直接書き込める経路は既に存在しない
-- ため、このmigrationでは変更しない。

-- company_admin_metadata / inventory_import_batches等、
-- Admin専用(service_role-only)テーブルは、一般customer向けの
-- role policyを一切追加しない（既存のservice_role専用設計を維持）。


-- ------------------------------------------------------------
-- 5. merge_wines(): 関数冒頭にowner限定チェックを追加する。
--
-- 引数シグネチャ・RETURNS TABLE・soft merge・quantity検証・
-- wine_classification_memory/wine_list_settings/stock_movements/
-- purchase_items移動・aliases・wine_merge_log・rollback挙動は
-- 20260906_repair_wine_merge_schema.sqlの内容から一切変更しない
-- （過去にRETURNS TABLE不一致でエラーになった実績があるため、
-- 関数本体はコピーし、冒頭に role guard を1つ追加しただけ）。
--
-- GRANT EXECUTE TO authenticated は維持する
-- （関数内部のrole guardをsecurity boundaryとする設計。
-- viewer/staffが直接RPCを呼び出しても、DB側で確実に拒否される）。
-- ------------------------------------------------------------
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
  -- Section 14: ワイン統合はownerのみ許可する。
  -- company所有権チェック（p_company_id不一致の拒否）より前に
  -- 判定しても安全（role判定に他companyの情報は必要ないため）。
  if current_user_role() <> 'owner' then
    raise exception 'Only company owners can merge wines.';
  end if;

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

-- 呼び出しは認証済みユーザーのみ許可（company_id不一致・role不一致は
-- 関数内チェックで拒否される。EXECUTE権限自体は変更しない）。
revoke all on function public.merge_wines from public;
grant execute on function public.merge_wines to authenticated;


-- ------------------------------------------------------------
-- 6. profiles: 一般顧客はrole/company_idを直接変更できない。
--
-- 本番の既存RLS設計として、profilesにはSELECT policyのみが
-- 存在し、authenticated向けのUPDATE/INSERT policyは無い
-- （一般ユーザーからのUPDATEはRLSで拒否される設計、と本タスクの
-- 前提で確認済み）。この既存設計をこのmigrationでは一切変更しない
-- ＝ 新しいUPDATE/INSERT policyをprofilesへ追加しない。
-- role変更・company所属の作成は、これまでどおりservice_role専用の
-- Admin API（/api/admin/company-users/**）だけが行う。
-- ------------------------------------------------------------


notify pgrst, 'reload schema';
