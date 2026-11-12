-- ============================================================
-- Section 19 店頭販売 post-apply 検証 + ロールバック付きRPCテスト
--
-- 20261108_section19_retail_sales.sql を本番適用した「直後」に、
-- Supabase SQL Editor で実行する。
--
-- 構成：
--   PART A  読み取り専用 post-apply verification（1ブロックずつ実行）
--   PART B  読み取り専用 テスト対象ID確認（1ブロックずつ実行）
--   PART C  ロールバック付きRPCテスト（BEGIN; 〜 ROLLBACK; を一括実行）
--
-- 対象会社：
--   会社名 'TEST - CUSTOMER ADMIN'（20260908_customer_roles.sql の
--   前提コメントに記録されているTEST会社）。ID はハードコードせず、
--   会社名の完全一致で取得し、ちょうど1社に決まらない場合や
--   'BON PINARD SAS' に一致した場合は PART C が即中止する。
--   別のTEST会社を使う場合は、このファイル内の
--   'TEST - CUSTOMER ADMIN' をすべて置換すること。
--
-- PART C の安全設計：
--   - BEGIN; 〜 ROLLBACK; の中で実行し、さらにテスト本体（DOブロック）は
--     成功時も失敗時も最後に必ず RAISE EXCEPTION で終わる。
--     → トランザクションは必ず中止され、何もCOMMITされない。
--   - SQL Editorはエラーメッセージを必ず表示するため、結果は
--     エラー欄に表示される：
--       成功: 'S19_POSTAPPLY_TEST_PASSED ...'（各チェックのOK一覧付き）
--       失敗: 'S19_TEST_FAILED [ステップ] ...'
--     ※ 'PASSED' もエラー表示になるのは意図通り（ロールバック保証のため）。
--   - 実行後、念のため `rollback;` だけを単独で1回実行してよい
--     （トランザクションが無ければ WARNING が出るだけで無害）。
--   - role確認のため TEST会社のユーザー1名の profiles.role を
--     トランザクション内で一時的に owner/staff/viewer に変更するが、
--     ROLLBACK で元に戻る（TEST会社の profiles 行のみ）。
--   - RPC・SELECTは `set local role authenticated` + JWT claims で
--     実際のアプリと同じ authenticated ロール・RLS 下で実行する。
-- ============================================================


-- ============================================================
-- PART A. post-apply verification（読み取り専用）
-- ============================================================

-- A-1. 新規4テーブルの存在（すべて非nullが期待値）
select to_regclass('public.retail_sale_settings') as retail_sale_settings,
       to_regclass('public.retail_sale_counters') as retail_sale_counters,
       to_regclass('public.retail_sales') as retail_sales,
       to_regclass('public.retail_sale_items') as retail_sale_items;

-- A-2. 新規3関数の存在とsignature
--   期待値：
--   confirm_retail_sale(p_client_request_id uuid, p_sale_date date,
--     p_customer_name text, p_payment_method text, p_items jsonb)
--     → TABLE(sale_id uuid, sale_number text, total_ttc numeric,
--             already_existed boolean) / security definer = true
--   cancel_retail_sale(p_sale_id uuid, p_reason text)
--     → TABLE(sale_id uuid, sale_number text, reversed_lines integer,
--             skipped_lines integer) / security definer = true
--   set_retail_sale_settings_audit() → trigger / security definer = false
select p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result,
       p.prosecdef as security_definer,
       p.proconfig as config
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('confirm_retail_sale', 'cancel_retail_sale',
                     'set_retail_sale_settings_audit')
 order by p.proname;

-- A-3. RPCの実行権限
--   期待値：anon_exec = false / authenticated_exec = true（2関数とも）
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('confirm_retail_sale', 'cancel_retail_sale')
 order by p.proname;

-- A-4. RLS enabled（4テーブルとも rls_enabled = true が期待値）
select c.relname,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('retail_sale_settings', 'retail_sale_counters',
                     'retail_sales', 'retail_sale_items')
 order by c.relname;

-- A-5. policy一覧
--   期待値（5件のみ）：
--   retail_sale_items    | retail_sale_items_select_company    | SELECT
--   retail_sale_settings | retail_sale_settings_insert_owner   | INSERT
--   retail_sale_settings | retail_sale_settings_select_company | SELECT
--   retail_sale_settings | retail_sale_settings_update_owner   | UPDATE
--   retail_sales         | retail_sales_select_company         | SELECT
--   （retail_sale_counters は0件。DELETE policy はどこにも無い）
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename like 'retail_sale%'
 order by tablename, policyname;

-- A-6. テーブルGRANT（anon / authenticated）
--   期待値：
--   retail_sale_settings : authenticated SELECT / INSERT / UPDATE
--   retail_sales         : authenticated SELECT
--   retail_sale_items    : authenticated SELECT
--   retail_sale_counters : 無し
--   anon                 : 全テーブル無し
select table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name like 'retail_sale%'
   and grantee in ('anon', 'authenticated')
 order by table_name, grantee, privilege_type;

-- A-7. 制約・トリガー（unique / FK / check と settings の audit trigger）
select conrelid::regclass as table_name, conname, contype,
       pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid in ('public.retail_sale_settings'::regclass,
                    'public.retail_sale_counters'::regclass,
                    'public.retail_sales'::regclass,
                    'public.retail_sale_items'::regclass)
 order by conrelid::regclass::text, conname;

select tgrelid::regclass as table_name, tgname,
       pg_get_triggerdef(oid) as definition
  from pg_trigger
 where tgrelid = 'public.retail_sale_settings'::regclass
   and not tgisinternal;

-- A-8. 適用直後はデータ0件（すべて0が期待値）
select (select count(*) from public.retail_sale_settings) as settings_rows,
       (select count(*) from public.retail_sale_counters) as counter_rows,
       (select count(*) from public.retail_sales) as sale_rows,
       (select count(*) from public.retail_sale_items) as item_rows,
       (select count(*) from public.stock_movements
         where notes like 'RETAIL_SALE:%') as retail_sale_movements;


-- ============================================================
-- PART B. テスト対象ID確認（読み取り専用）
-- PART C を実行する前に、対象が正しいTEST会社であることを目視確認する。
-- ============================================================

-- B-1. 会社名に TEST を含む会社（'TEST - CUSTOMER ADMIN' がちょうど1社あること）
select c.id as company_id,
       c.name,
       count(p.id) as user_count,
       string_agg(distinct p.role, ', ') as roles
  from public.companies c
  left join public.profiles p
    on p.company_id = c.id
 where c.name ilike '%TEST%'
 group by c.id, c.name
 order by c.name;

-- B-2. PART C が使うテストユーザー（TEST会社の profiles を id 順で先頭1名）
select p.id as user_id, p.role, p.company_id
  from public.profiles p
  join public.companies c
    on c.id = p.company_id
 where c.name = 'TEST - CUSTOMER ADMIN'
 order by p.id
 limit 1;

-- B-3. PART C が使うテストワイン（在庫1以上・active・未統合。
--      在庫2以上を優先。2以上が無い場合 staff の確定テストはスキップされる）
select iv.wine_id, w.producer, w.wine_name, w.vintage, iv.current_quantity
  from public.inventory_view iv
  join public.wines w
    on w.id = iv.wine_id
   and w.company_id = iv.company_id
  join public.companies c
    on c.id = iv.company_id
 where c.name = 'TEST - CUSTOMER ADMIN'
   and w.is_active = true
   and w.merged_into_wine_id is null
   and iv.current_quantity >= 1
 order by (iv.current_quantity >= 2) desc, iv.wine_id
 limit 1;


-- ============================================================
-- PART C. ロールバック付きRPCテスト
-- BEGIN; から ROLLBACK; までを一括で実行する。
-- 結果はエラー欄に 'S19_POSTAPPLY_TEST_PASSED' または
-- 'S19_TEST_FAILED [...]' として表示される（どちらも全てROLLBACK）。
-- ============================================================

begin;

do $$
declare
  c_test_company_name constant text := 'TEST - CUSTOMER ADMIN';
  c_unit_price constant numeric := 12.00;
  c_vat_rate constant numeric := 20.00;

  v_company uuid;
  v_company_count integer;
  v_user uuid;
  v_orig_role text;
  v_wine uuid;
  v_stock_before numeric;
  v_stock numeric;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_year integer := extract(year from (now() at time zone 'Europe/Paris'))::integer;

  v_req1 uuid := gen_random_uuid();
  v_req2 uuid := gen_random_uuid();
  v_req3 uuid := gen_random_uuid();
  v_req4 uuid := gen_random_uuid();

  v_res record;
  v_dup record;
  v_cancel record;
  v_sale record;
  v_item record;
  v_mov record;
  v_rev record;

  v_cnt integer;
  v_rows integer;
  v_err text;
  v_over integer;

  v_sales_before integer;
  v_moves_before integer;
  v_counter_before integer;
  v_counter_after integer;

  v_staff_sale_id uuid;
  v_staff_qty integer := 0;

  v_log text := '';
begin
  -- ----------------------------------------------------------
  -- 0. 対象の解決（postgresロールで実行）
  -- ----------------------------------------------------------
  select count(*) into v_company_count
  from public.companies c
  where c.name = c_test_company_name;

  if v_company_count <> 1 then
    raise exception 'S19_TEST_FAILED [0] TEST会社 "%" が % 件（1件である必要あり）',
      c_test_company_name, v_company_count;
  end if;

  select c.id into v_company
  from public.companies c
  where c.name = c_test_company_name;

  if exists (
    select 1 from public.companies c
    where c.id = v_company and c.name ilike 'BON PINARD SAS%'
  ) then
    raise exception 'S19_TEST_FAILED [0] 対象がBON PINARD SASです。中止します。';
  end if;

  select p.id, p.role into v_user, v_orig_role
  from public.profiles p
  where p.company_id = v_company
  order by p.id
  limit 1;

  if v_user is null then
    raise exception 'S19_TEST_FAILED [0] TEST会社にユーザー(profiles)がありません';
  end if;

  select iv.wine_id, iv.current_quantity
    into v_wine, v_stock_before
  from public.inventory_view iv
  join public.wines w
    on w.id = iv.wine_id
   and w.company_id = iv.company_id
  where iv.company_id = v_company
    and w.is_active = true
    and w.merged_into_wine_id is null
    and iv.current_quantity >= 1
  order by (iv.current_quantity >= 2) desc, iv.wine_id
  limit 1;

  if v_wine is null then
    raise exception 'S19_TEST_FAILED [0] TEST会社に在庫1以上のactiveワインがありません';
  end if;

  v_log := v_log || format(
    E'\nINFO company=%s user=%s(元role=%s) wine=%s stock_before=%s today=%s',
    v_company, v_user, v_orig_role, v_wine, v_stock_before, v_today
  );

  -- JWT claims でテストユーザーになりすます（transaction-local）
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- owner にしてから authenticated ロールへ
  update public.profiles set role = 'owner'
  where id = v_user and company_id = v_company;

  execute 'set local role authenticated';

  if public.current_company_id() is distinct from v_company
    or public.current_user_role() is distinct from 'owner'
  then
    raise exception 'S19_TEST_FAILED [0] なりすまし失敗 company=% role=%',
      public.current_company_id(), public.current_user_role();
  end if;

  v_log := v_log || E'\nOK  [0] authenticated + owner としてTEST会社に接続';

  -- ----------------------------------------------------------
  -- 1. retail_sale_settings（owner・RLS経由でupsert）
  -- ----------------------------------------------------------
  insert into public.retail_sale_settings (company_id, vat_rate_percent)
  values (v_company, c_vat_rate)
  on conflict (company_id)
  do update set vat_rate_percent = excluded.vat_rate_percent;

  select rs.vat_rate_percent, rs.updated_by
    into v_rev
  from public.retail_sale_settings rs
  where rs.company_id = v_company;

  if v_rev.vat_rate_percent is distinct from c_vat_rate
    or v_rev.updated_by is distinct from v_user
  then
    raise exception 'S19_TEST_FAILED [1] settings vat=% updated_by=%',
      v_rev.vat_rate_percent, v_rev.updated_by;
  end if;

  v_log := v_log || E'\nOK  [1] owner がTVA率20.00を設定（updated_byはトリガーで本人）';

  -- ----------------------------------------------------------
  -- 2. confirm_retail_sale（owner・1本・12.00€ TTC）
  -- ----------------------------------------------------------
  select * into v_res
  from public.confirm_retail_sale(
    v_req1,
    v_today,
    'S19 POSTAPPLY TEST',
    'CASH',
    jsonb_build_array(jsonb_build_object(
      'wine_id', v_wine,
      'quantity', 1,
      'unit_price_ttc', c_unit_price,
      'price_source', 'MANUAL'
    ))
  );

  if v_res.sale_id is null
    or v_res.sale_number !~ ('^VENTE-' || v_year::text || '-[0-9]{5,}$')
    or v_res.total_ttc <> 12.00
    or v_res.already_existed is distinct from false
  then
    raise exception 'S19_TEST_FAILED [2-1] 戻り値 sale_id=% number=% ttc=% existed=%',
      v_res.sale_id, v_res.sale_number, v_res.total_ttc, v_res.already_existed;
  end if;

  v_log := v_log || format(E'\nOK  [2-1] confirm成功 %s total_ttc=%s',
    v_res.sale_number, v_res.total_ttc);

  select * into v_sale
  from public.retail_sales s
  where s.id = v_res.sale_id;

  if v_sale.id is null
    or v_sale.company_id <> v_company
    or v_sale.status <> 'CONFIRMED'
    or v_sale.sale_date <> v_today
    or v_sale.customer_name is distinct from 'S19 POSTAPPLY TEST'
    or v_sale.payment_method is distinct from 'CASH'
    or v_sale.total_bottles <> 1
    or v_sale.total_ht <> 10.00
    or v_sale.total_vat <> 2.00
    or v_sale.total_ttc <> 12.00
    or v_sale.created_by is distinct from v_user
    or v_sale.client_request_id <> v_req1
  then
    raise exception 'S19_TEST_FAILED [2-2] retail_sales 行不一致: %', row_to_json(v_sale);
  end if;

  v_log := v_log || E'\nOK  [2-2] retail_sales（HT 10.00 / TVA 2.00 / TTC 12.00 / CONFIRMED / created_by）';

  select count(*) into v_cnt
  from public.retail_sale_items i
  where i.sale_id = v_res.sale_id;

  select * into v_item
  from public.retail_sale_items i
  where i.sale_id = v_res.sale_id;

  if v_cnt <> 1
    or v_item.company_id <> v_company
    or v_item.line_no <> 1
    or v_item.wine_id <> v_wine
    or v_item.quantity <> 1
    or v_item.vat_rate_percent <> c_vat_rate
    or v_item.unit_price_ttc <> 12.00
    or v_item.line_total_ht <> 10.00
    or v_item.line_total_vat <> 2.00
    or v_item.line_total_ttc <> 12.00
    or v_item.price_source <> 'MANUAL'
    or v_item.stock_movement_id is null
  then
    raise exception 'S19_TEST_FAILED [2-3] retail_sale_items 不一致 count=% row=%',
      v_cnt, row_to_json(v_item);
  end if;

  v_log := v_log || E'\nOK  [2-3] retail_sale_items 1行（スナップショット・金額・movement紐付け）';

  select * into v_mov
  from public.stock_movements m
  where m.id = v_item.stock_movement_id;

  if v_mov.id is null
    or v_mov.company_id <> v_company
    or v_mov.wine_id <> v_wine
    or v_mov.movement_type <> 'SALE'
    or v_mov.quantity <> -1
    or v_mov.invoice_id is not null
    or v_mov.movement_date <> v_today
    or v_mov.notes is distinct from
      ('RETAIL_SALE:' || v_res.sale_number || ' | sale:' || v_res.sale_id::text)
  then
    raise exception 'S19_TEST_FAILED [2-4] SALE movement 不一致: %', row_to_json(v_mov);
  end if;

  select count(*) into v_cnt
  from public.stock_movements m
  where m.company_id = v_company
    and m.notes like 'RETAIL_SALE:' || v_res.sale_number || ' |%';

  if v_cnt <> 1 then
    raise exception 'S19_TEST_FAILED [2-4] SALE movement 件数=%（1が期待値）', v_cnt;
  end if;

  v_log := v_log || E'\nOK  [2-4] stock_movements SALE 1件 quantity=-1 notes形式OK';

  select coalesce(iv.current_quantity, 0) into v_stock
  from public.inventory_view iv
  where iv.company_id = v_company
    and iv.wine_id = v_wine;

  if v_stock <> v_stock_before - 1 then
    raise exception 'S19_TEST_FAILED [2-5] 在庫 % → %（-1が期待値）', v_stock_before, v_stock;
  end if;

  v_log := v_log || format(E'\nOK  [2-5] inventory_view 在庫 %s → %s', v_stock_before, v_stock);

  -- ----------------------------------------------------------
  -- 3. 二重送信防止（同じ client_request_id で再実行）
  -- ----------------------------------------------------------
  select * into v_dup
  from public.confirm_retail_sale(
    v_req1,
    v_today,
    'S19 POSTAPPLY TEST',
    'CASH',
    jsonb_build_array(jsonb_build_object(
      'wine_id', v_wine,
      'quantity', 1,
      'unit_price_ttc', c_unit_price,
      'price_source', 'MANUAL'
    ))
  );

  if v_dup.sale_id is distinct from v_res.sale_id
    or v_dup.sale_number is distinct from v_res.sale_number
    or v_dup.already_existed is distinct from true
  then
    raise exception 'S19_TEST_FAILED [3-1] 再送で別伝票 sale_id=% existed=%',
      v_dup.sale_id, v_dup.already_existed;
  end if;

  select count(*) into v_cnt
  from public.retail_sales s
  where s.company_id = v_company
    and s.client_request_id = v_req1;

  if v_cnt <> 1 then
    raise exception 'S19_TEST_FAILED [3-2] 同一request_idの伝票が % 件', v_cnt;
  end if;

  select count(*) into v_cnt
  from public.stock_movements m
  where m.company_id = v_company
    and m.notes like 'RETAIL_SALE:' || v_res.sale_number || ' |%';

  select coalesce(iv.current_quantity, 0) into v_stock
  from public.inventory_view iv
  where iv.company_id = v_company
    and iv.wine_id = v_wine;

  if v_cnt <> 1 or v_stock <> v_stock_before - 1 then
    raise exception 'S19_TEST_FAILED [3-3] 再送で在庫変動 movements=% stock=%', v_cnt, v_stock;
  end if;

  v_log := v_log || E'\nOK  [3] 同じclient_request_idは既存伝票を返す（already_existed=true・movement増加なし）';

  -- ----------------------------------------------------------
  -- 4. 在庫超過（エラーになり、何も追加されない）
  -- ----------------------------------------------------------
  v_over := floor(v_stock)::integer + 1;

  if v_over > 9999 then
    v_log := v_log || E'\nSKIP[4] 在庫が9999超のため在庫超過テストを省略';
  else
    select count(*) into v_sales_before
    from public.retail_sales s
    where s.company_id = v_company;

    select count(*) into v_moves_before
    from public.stock_movements m
    where m.company_id = v_company
      and m.wine_id = v_wine;

    execute 'reset role';

    select coalesce(max(rc.last_number), 0) into v_counter_before
    from public.retail_sale_counters rc
    where rc.company_id = v_company
      and rc.sale_year = v_year;

    execute 'set local role authenticated';

    v_err := null;

    begin
      perform *
      from public.confirm_retail_sale(
        v_req2,
        v_today,
        null,
        null,
        jsonb_build_array(jsonb_build_object(
          'wine_id', v_wine,
          'quantity', v_over,
          'unit_price_ttc', c_unit_price,
          'price_source', 'LIST'
        ))
      );
    exception when others then
      v_err := sqlerrm;
    end;

    if v_err is null or v_err not like 'RETAIL_INSUFFICIENT_STOCK%' then
      raise exception 'S19_TEST_FAILED [4-1] 在庫超過(%本)が拒否されない err=%', v_over, v_err;
    end if;

    v_log := v_log || format(E'\nOK  [4-1] 在庫超過 %s本 → %s', v_over, v_err);

    select count(*) into v_cnt
    from public.retail_sales s
    where s.company_id = v_company;

    select count(*) into v_rows
    from public.stock_movements m
    where m.company_id = v_company
      and m.wine_id = v_wine;

    if v_cnt <> v_sales_before or v_rows <> v_moves_before then
      raise exception 'S19_TEST_FAILED [4-2] 失敗時に行が残った sales %→% movements %→%',
        v_sales_before, v_cnt, v_moves_before, v_rows;
    end if;

    if exists (
      select 1 from public.retail_sales s
      where s.company_id = v_company
        and s.client_request_id = v_req2
    ) then
      raise exception 'S19_TEST_FAILED [4-2] 失敗したrequestの伝票が存在する';
    end if;

    execute 'reset role';

    select coalesce(max(rc.last_number), 0) into v_counter_after
    from public.retail_sale_counters rc
    where rc.company_id = v_company
      and rc.sale_year = v_year;

    execute 'set local role authenticated';

    if v_counter_after <> v_counter_before then
      raise exception 'S19_TEST_FAILED [4-3] 失敗時に採番が進んだ % → %',
        v_counter_before, v_counter_after;
    end if;

    v_log := v_log || E'\nOK  [4-2] retail_sales / stock_movements / 採番カウンタに変化なし';
  end if;

  -- ----------------------------------------------------------
  -- 6-a. staff：confirm OK / cancel NG / 設定更新NG
  -- ----------------------------------------------------------
  execute 'reset role';
  update public.profiles set role = 'staff'
  where id = v_user and company_id = v_company;
  execute 'set local role authenticated';

  if public.current_user_role() is distinct from 'staff' then
    raise exception 'S19_TEST_FAILED [6-a] staffへの切替失敗';
  end if;

  if v_stock >= 1 then
    select * into v_dup
    from public.confirm_retail_sale(
      v_req3,
      v_today,
      null,
      null,
      jsonb_build_array(jsonb_build_object(
        'wine_id', v_wine,
        'quantity', 1,
        'unit_price_ttc', c_unit_price,
        'price_source', 'LIST'
      ))
    );

    if v_dup.sale_id is null or v_dup.already_existed is distinct from false then
      raise exception 'S19_TEST_FAILED [6-a1] staffのconfirmが失敗';
    end if;

    v_staff_sale_id := v_dup.sale_id;
    v_staff_qty := 1;

    v_log := v_log || format(E'\nOK  [6-a1] staff confirm OK（%s）', v_dup.sale_number);
  else
    v_log := v_log || E'\nSKIP[6-a1] 在庫不足のため staff confirm を省略（在庫2以上のワインが無い）';
  end if;

  v_err := null;

  begin
    perform * from public.cancel_retail_sale(v_res.sale_id, 'staff test');
  exception when others then
    v_err := sqlerrm;
  end;

  if v_err is null or v_err not like 'RETAIL_FORBIDDEN%' then
    raise exception 'S19_TEST_FAILED [6-a2] staffのcancelが拒否されない err=%', v_err;
  end if;

  v_log := v_log || E'\nOK  [6-a2] staff cancel NG（RETAIL_FORBIDDEN）';

  update public.retail_sale_settings
  set vat_rate_percent = 5.50
  where company_id = v_company;

  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'S19_TEST_FAILED [6-a3] staffがTVA率を更新できた';
  end if;

  v_log := v_log || E'\nOK  [6-a3] staff はTVA率を更新できない（RLS 0行）';

  -- ----------------------------------------------------------
  -- 6-b. viewer：confirm NG / cancel NG / 閲覧OK
  -- ----------------------------------------------------------
  execute 'reset role';
  update public.profiles set role = 'viewer'
  where id = v_user and company_id = v_company;
  execute 'set local role authenticated';

  if public.current_user_role() is distinct from 'viewer' then
    raise exception 'S19_TEST_FAILED [6-b] viewerへの切替失敗';
  end if;

  v_err := null;

  begin
    perform *
    from public.confirm_retail_sale(
      v_req4,
      v_today,
      null,
      null,
      jsonb_build_array(jsonb_build_object(
        'wine_id', v_wine,
        'quantity', 1,
        'unit_price_ttc', c_unit_price,
        'price_source', 'LIST'
      ))
    );
  exception when others then
    v_err := sqlerrm;
  end;

  if v_err is null or v_err not like 'RETAIL_FORBIDDEN%' then
    raise exception 'S19_TEST_FAILED [6-b1] viewerのconfirmが拒否されない err=%', v_err;
  end if;

  v_log := v_log || E'\nOK  [6-b1] viewer confirm NG（RETAIL_FORBIDDEN）';

  v_err := null;

  begin
    perform * from public.cancel_retail_sale(v_res.sale_id, 'viewer test');
  exception when others then
    v_err := sqlerrm;
  end;

  if v_err is null or v_err not like 'RETAIL_FORBIDDEN%' then
    raise exception 'S19_TEST_FAILED [6-b2] viewerのcancelが拒否されない err=%', v_err;
  end if;

  v_log := v_log || E'\nOK  [6-b2] viewer cancel NG（RETAIL_FORBIDDEN）';

  select count(*) into v_cnt
  from public.retail_sales s
  where s.id = v_res.sale_id;

  select count(*) into v_rows
  from public.retail_sale_items i
  where i.sale_id = v_res.sale_id;

  if v_cnt <> 1 or v_rows <> 1 then
    raise exception 'S19_TEST_FAILED [6-b3] viewerが伝票を閲覧できない sales=% items=%', v_cnt, v_rows;
  end if;

  v_log := v_log || E'\nOK  [6-b3] viewer は伝票・明細を閲覧できる';

  -- ----------------------------------------------------------
  -- 5. cancel_retail_sale（owner）
  -- ----------------------------------------------------------
  execute 'reset role';
  update public.profiles set role = 'owner'
  where id = v_user and company_id = v_company;
  execute 'set local role authenticated';

  select * into v_cancel
  from public.cancel_retail_sale(v_res.sale_id, 'S19 POSTAPPLY TEST');

  if v_cancel.sale_id is distinct from v_res.sale_id
    or v_cancel.reversed_lines <> 1
    or v_cancel.skipped_lines <> 0
  then
    raise exception 'S19_TEST_FAILED [5-1] cancel戻り値 reversed=% skipped=%',
      v_cancel.reversed_lines, v_cancel.skipped_lines;
  end if;

  v_log := v_log || E'\nOK  [5-1] owner cancel OK（reversed_lines=1 / skipped_lines=0）';

  select count(*) into v_cnt
  from public.stock_movements m
  where m.company_id = v_company
    and m.movement_type = 'REVERSAL'
    and m.notes like 'REVERSAL_OF:' || v_item.stock_movement_id::text || '%';

  select * into v_rev
  from public.stock_movements m
  where m.company_id = v_company
    and m.movement_type = 'REVERSAL'
    and m.notes like 'REVERSAL_OF:' || v_item.stock_movement_id::text || '%';

  if v_cnt <> 1
    or v_rev.wine_id <> v_wine
    or v_rev.quantity <> 1
    or v_rev.invoice_id is not null
    or v_rev.notes is distinct from
      ('REVERSAL_OF:' || v_item.stock_movement_id::text ||
       ' | RETAIL_SALE_CANCEL:' || v_res.sale_number)
    or v_rev.notes !~ '^REVERSAL_OF:[0-9a-fA-F-]+'
  then
    raise exception 'S19_TEST_FAILED [5-2] REVERSAL不一致 count=% row=%', v_cnt, row_to_json(v_rev);
  end if;

  v_log := v_log || format(E'\nOK  [5-2] REVERSAL 1件 quantity=+1 notes=%s', v_rev.notes);

  select * into v_sale
  from public.retail_sales s
  where s.id = v_res.sale_id;

  if v_sale.status <> 'CANCELLED'
    or v_sale.cancelled_at is null
    or v_sale.cancelled_by is distinct from v_user
    or v_sale.cancel_reason is distinct from 'S19 POSTAPPLY TEST'
  then
    raise exception 'S19_TEST_FAILED [5-3] 取消後ヘッダー不一致: %', row_to_json(v_sale);
  end if;

  v_log := v_log || E'\nOK  [5-3] retail_sales.status=CANCELLED（cancelled_at / cancelled_by / 理由）・行は残る';

  select coalesce(iv.current_quantity, 0) into v_stock
  from public.inventory_view iv
  where iv.company_id = v_company
    and iv.wine_id = v_wine;

  if v_stock <> v_stock_before - v_staff_qty then
    raise exception 'S19_TEST_FAILED [5-4] 取消後の在庫=%（期待値 %）',
      v_stock, v_stock_before - v_staff_qty;
  end if;

  v_log := v_log || format(E'\nOK  [5-4] 取消で在庫が戻った（%s）', v_stock);

  v_err := null;

  begin
    perform * from public.cancel_retail_sale(v_res.sale_id, 'again');
  exception when others then
    v_err := sqlerrm;
  end;

  if v_err is null or v_err not like 'RETAIL_SALE_ALREADY_CANCELLED%' then
    raise exception 'S19_TEST_FAILED [5-5] 二重取消が拒否されない err=%', v_err;
  end if;

  v_log := v_log || E'\nOK  [5-5] 二重取消は RETAIL_SALE_ALREADY_CANCELLED';

  if v_staff_sale_id is not null then
    perform * from public.cancel_retail_sale(v_staff_sale_id, 'S19 POSTAPPLY TEST staff sale');

    select coalesce(iv.current_quantity, 0) into v_stock
    from public.inventory_view iv
    where iv.company_id = v_company
      and iv.wine_id = v_wine;

    if v_stock <> v_stock_before then
      raise exception 'S19_TEST_FAILED [5-6] 全取消後の在庫=%（期待値 %）', v_stock, v_stock_before;
    end if;

    v_log := v_log || format(E'\nOK  [5-6] staff伝票もowner取消 → 在庫が開始時と同じ（%s）', v_stock);
  end if;

  -- ----------------------------------------------------------
  -- 終了：成功でも必ず例外で終わり、全てをROLLBACKさせる
  -- ----------------------------------------------------------
  execute 'reset role';

  raise exception 'S19_POSTAPPLY_TEST_PASSED（全チェック合格・全変更はROLLBACKされます）%', v_log;
end;
$$;

rollback;
