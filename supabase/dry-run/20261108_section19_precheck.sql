-- ============================================================
-- Section 19 店頭販売 migration 適用前の前提確認（読み取り専用）
--
-- 20261108_section19_retail_sales.sql を適用する前に、
-- SQL Editorで1ブロックずつ実行して結果を確認してください。
-- このファイルはSELECTのみで、DBを一切変更しません。
-- ============================================================

-- 1. stock_movements の列（id が uuid、quantity / unit_cost_ht /
--    movement_date / notes / invoice_id が存在し、
--    company_id 等に想定外のNOT NULL列が無いこと）
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'stock_movements'
 order by ordinal_position;

-- 2. stock_movements の制約（movement_type のCHECKが SALE / REVERSAL を
--    許可していること、invoice_id のFK先）
select conname, contype, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.stock_movements'::regclass
 order by conname;

-- 3. stock_movements のトリガー（INSERT時に想定外の処理が無いこと）
select tgname, pg_get_triggerdef(oid) as definition
  from pg_trigger
 where tgrelid = 'public.stock_movements'::regclass
   and not tgisinternal;

-- 4. inventory_view の定義（current_quantity が stock_movements の
--    全movement_typeの quantity 合計であること、avg_cost_ht の算出方法）
select pg_get_viewdef('public.inventory_view'::regclass, true);

-- 5. wines の列（company_id / producer / wine_name / cuvee / vintage /
--    bottle_size_cl / is_active / merged_into_wine_id）
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'wines'
 order by ordinal_position;

-- 6. wine_list_settings.sale_price の型
select column_name, data_type, numeric_precision, numeric_scale
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'wine_list_settings'
   and column_name in ('sale_price', 'manual_price', 'is_listed');

-- 7. 同名オブジェクトが既に無いこと（すべて0件 / null が期待値）
select to_regclass('public.retail_sale_settings') as retail_sale_settings,
       to_regclass('public.retail_sale_counters') as retail_sale_counters,
       to_regclass('public.retail_sales') as retail_sales,
       to_regclass('public.retail_sale_items') as retail_sale_items;

select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('confirm_retail_sale', 'cancel_retail_sale',
                   'set_retail_sale_settings_audit');

-- 8. current_company_id() / current_user_role() が存在すること
select proname, prosecdef
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('current_company_id', 'current_user_role');

-- 9. 既存の notes が 'RETAIL_SALE:' で始まる movement が無いこと（0件が期待値）
select count(*) as existing_retail_sale_notes
  from public.stock_movements
 where notes like 'RETAIL_SALE:%';

-- 10. PostgreSQLバージョン（hashtextextended は PG11以上）
select version();
