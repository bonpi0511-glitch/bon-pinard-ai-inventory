-- ============================================================
-- Section 19「店頭販売 / Vente au comptoir」
--   販売伝票 + 在庫減算(SALE) + 販売履歴 + 取消(REVERSAL)
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- 重要：このファイルはまだ適用しないでください
-- （ユーザーの確認後に適用）。
-- 適用前に supabase/dry-run/20261108_section19_precheck.sql の
-- 読み取り専用クエリで前提を確認してください。
--
-- 前提（2026-11-12 本番precheck確認済み / PostgreSQL 17.11）：
--   stock_movements: id uuid default gen_random_uuid(), company_id/wine_id
--     uuid NOT NULL, invoice_id NULL, movement_type text NOT NULL,
--     quantity numeric NOT NULL, unit_cost_ht numeric, movement_date date
--     NOT NULL, notes text, created_at。movement_type/quantity の
--     CHECK制約なし、トリガーなし。
--   inventory_view: current_quantity = coalesce(sum(quantity),0)
--     （全movement_type）、avg_cost_ht = 正のquantityの加重平均。
--   wines: company_id / producer / wine_name / cuvee / vintage /
--     bottle_size_cl / is_active / merged_into_wine_id あり。
--   wine_list_settings.sale_price numeric(12,2)（TTCとして扱う）。
--   current_company_id() / current_user_role() は security definer で存在。
--   retail_sale* テーブル・関数は未存在、RETAIL_SALE: notes は0件。
--
-- 確定仕様（2026-11-08）：
--   - wine_list_settings.sale_price は TTC として扱う
--     （店頭販売では is_listed は無視）。
--   - TVA率は会社ごとに1つ。ownerが画面で入力し、コードに固定しない
--     （retail_sale_settings.vat_rate_percent。未設定なら確定不可）。
--   - 伝票番号は VENTE-YYYY-00001。会社×年ごとに00001から採番。
--     Facture番号とは別系列。
--   - 販売日は過去日OK・未来日NG（Europe/Paris基準）。
--   - 顧客は自由入力のみ（空欄 = Client comptoir / 一般客）。
--   - 確定：owner/staff、閲覧：全role、取消：ownerのみ。
--   - Section 19は販売伝票・在庫減算・履歴の用途であり、
--     正式な入金記録・認証レジ(NF525等)の代替ではない。
--     payment_method は補助情報としてのみ保持する。
--
-- 安全設計：
--   - 在庫は stock_movements のINSERTのみで変動させる
--     （SALE = マイナス、取消 = REVERSAL プラス）。
--     stock_movements のテーブル定義・既存policyは一切変更しない。
--   - 伝票レコードはDELETEしない（DELETE policy / GRANT無し）。
--   - retail_sales / retail_sale_items への書き込みは
--     security definer RPC（confirm_retail_sale / cancel_retail_sale）
--     経由のみ。authenticatedにはSELECTのみGRANTする。
--   - RPC1回 = 1トランザクション。途中のraiseで伝票・明細・
--     stock_movements・採番カウンタがすべてロールバックされる
--     （部分成功なし・番号の欠番なし）。
--   - 二重送信は client_request_id（クライアント生成UUID）で
--     冪等化する。同じIDの再送は既存伝票を返すだけ。
--
-- 既存ロジックとの整合：
--   - SALE行の notes は 'RETAIL_SALE:<伝票番号> | sale:<sale_id>'。
--     アプリ側Section 9はこの接頭辞のSALE行の個別取消を無効化する。
--   - 取消のREVERSAL行の notes は Section 9 と同じ
--     'REVERSAL_OF:<元movement id> | RETAIL_SALE_CANCEL:<伝票番号>'
--     形式にする（Section 9の取消済み判定・表示がそのまま効く）。
--   - SALE行の unit_cost_ht は Section 8 と同じく
--     inventory_view.avg_cost_ht（原価）を入れる。販売価格は
--     retail_sale_items 側にだけ保存する。
-- ============================================================


-- ------------------------------------------------------------
-- 1. retail_sale_settings（会社ごとの店頭販売設定）
-- ------------------------------------------------------------
create table if not exists public.retail_sale_settings (
  company_id uuid not null
    references public.companies(id),

  -- 例: 20.00 = 20%。nullの間は販売確定不可。
  vat_rate_percent numeric(5,2) null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null,

  constraint retail_sale_settings_pkey
    primary key (company_id),

  constraint retail_sale_settings_vat_rate_check
    check (
      vat_rate_percent is null
      or (vat_rate_percent >= 0 and vat_rate_percent < 100)
    )
);

comment on table public.retail_sale_settings is
  'Section 19 店頭販売の会社別設定。1 company = 1行。TVA率はownerが画面で入力する（コードに固定しない）。';

comment on column public.retail_sale_settings.vat_rate_percent is
  '店頭販売に適用するTVA率（%）。例 20.00。nullの場合 confirm_retail_sale() は確定を拒否する。確定時に retail_sale_items.vat_rate_percent へスナップショットされるため、変更しても過去伝票には影響しない。';

create or replace function public.set_retail_sale_settings_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();

  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
    new.company_id := old.company_id;
  end if;

  return new;
end;
$$;

drop trigger if exists retail_sale_settings_set_audit
  on public.retail_sale_settings;

create trigger retail_sale_settings_set_audit
  before insert or update
  on public.retail_sale_settings
  for each row
  execute function public.set_retail_sale_settings_audit();


-- ------------------------------------------------------------
-- 2. retail_sale_counters（伝票番号の採番カウンタ）
--
-- sequenceは使わない（会社別・年別にできず、ロールバックで欠番が出るため）。
-- confirm_retail_sale() 内の INSERT ... ON CONFLICT DO UPDATE で
-- 行ロックを取りながら+1する。トランザクションが失敗すれば
-- カウンタも戻るため欠番にならない。
-- アプリからは一切アクセスさせない（policy・GRANT無し）。
-- ------------------------------------------------------------
create table if not exists public.retail_sale_counters (
  company_id uuid not null
    references public.companies(id),

  sale_year integer not null,
  last_number integer not null default 0,

  updated_at timestamptz not null default now(),

  constraint retail_sale_counters_pkey
    primary key (company_id, sale_year),

  constraint retail_sale_counters_year_check
    check (sale_year between 2000 and 2999),

  constraint retail_sale_counters_number_check
    check (last_number >= 0)
);

comment on table public.retail_sale_counters is
  'Section 19 伝票番号(VENTE-YYYY-NNNNN)の会社×年別カウンタ。confirm_retail_sale()内からのみ更新する。';


-- ------------------------------------------------------------
-- 3. retail_sales（伝票ヘッダー）
-- ------------------------------------------------------------
create table if not exists public.retail_sales (
  id uuid not null default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id),

  sale_number text not null,
  sale_year integer not null,
  sale_date date not null,

  -- 二重送信防止用（クライアント生成UUID）
  client_request_id uuid not null,

  -- null = Client comptoir / 一般客
  customer_name text null,

  status text not null default 'CONFIRMED',

  total_bottles integer not null default 0,
  total_ht numeric(12,2) not null default 0,
  total_vat numeric(12,2) not null default 0,
  total_ttc numeric(12,2) not null default 0,

  -- 将来の割引用。今回の実装では常に0。
  discount_ttc numeric(12,2) not null default 0,

  -- 補助情報のみ。正式な決済・入金記録ではない。
  payment_method text null,

  notes text null,

  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  cancelled_at timestamptz null,
  cancelled_by uuid null,
  cancel_reason text null,

  constraint retail_sales_pkey
    primary key (id),

  constraint retail_sales_company_number_key
    unique (company_id, sale_number),

  constraint retail_sales_company_request_key
    unique (company_id, client_request_id),

  constraint retail_sales_status_check
    check (status in ('CONFIRMED', 'CANCELLED')),

  constraint retail_sales_payment_method_check
    check (
      payment_method is null
      or payment_method in ('CASH', 'CARD', 'OTHER')
    ),

  constraint retail_sales_customer_name_length_check
    check (customer_name is null or char_length(customer_name) <= 200),

  constraint retail_sales_cancel_consistency_check
    check (
      (status = 'CONFIRMED' and cancelled_at is null)
      or (status = 'CANCELLED' and cancelled_at is not null)
    ),

  constraint retail_sales_amounts_check
    check (
      total_bottles >= 0
      and total_ht >= 0
      and total_vat >= 0
      and total_ttc >= 0
      and discount_ttc >= 0
    )
);

create index if not exists retail_sales_company_date_idx
  on public.retail_sales (company_id, sale_date desc, created_at desc);

comment on table public.retail_sales is
  'Section 19 店頭販売伝票ヘッダー。INSERT/UPDATEは confirm_retail_sale() / cancel_retail_sale() のみ。DELETEはしない（取消は status=CANCELLED + REVERSAL movement）。正式な入金記録・認証レジの代替ではない。';

comment on column public.retail_sales.payment_method is
  '補助情報（CASH/CARD/OTHER）。正式な決済記録としては扱わない。';


-- ------------------------------------------------------------
-- 4. retail_sale_items（伝票明細・スナップショット）
-- ------------------------------------------------------------
create table if not exists public.retail_sale_items (
  id uuid not null default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id),

  sale_id uuid not null
    references public.retail_sales(id),

  line_no integer not null,

  wine_id uuid not null
    references public.wines(id),

  -- このラインで作成したSALE movement（取消時の REVERSAL_OF 対象）。
  -- merge_wines() は stock_movements.wine_id をMasterへ付け替えるため、
  -- 統合後はこの movement の wine_id と上の wine_id が一致しないことがある
  -- （wine_id はスナップショットとして元のまま残す）。
  stock_movement_id uuid not null
    references public.stock_movements(id),

  producer_snapshot text null,
  wine_name_snapshot text null,
  cuvee_snapshot text null,
  vintage_snapshot text null,
  bottle_size_cl_snapshot numeric null,

  quantity integer not null,

  vat_rate_percent numeric(5,2) not null,
  unit_price_ttc numeric(12,2) not null,
  unit_price_ht numeric(12,4) not null,

  line_total_ht numeric(12,2) not null,
  line_total_vat numeric(12,2) not null,
  line_total_ttc numeric(12,2) not null,

  -- 価格の出所（LIST = wine_list_settings.sale_price / MANUAL = 手入力）
  price_source text not null default 'LIST',

  created_at timestamptz not null default now(),

  constraint retail_sale_items_pkey
    primary key (id),

  constraint retail_sale_items_sale_line_key
    unique (sale_id, line_no),

  constraint retail_sale_items_sale_wine_key
    unique (sale_id, wine_id),

  constraint retail_sale_items_movement_key
    unique (stock_movement_id),

  constraint retail_sale_items_quantity_check
    check (quantity > 0),

  constraint retail_sale_items_price_check
    check (unit_price_ttc > 0),

  constraint retail_sale_items_price_source_check
    check (price_source in ('LIST', 'MANUAL')),

  constraint retail_sale_items_totals_check
    check (
      line_total_ttc = line_total_ht + line_total_vat
      and line_total_ht >= 0
      and line_total_vat >= 0
    )
);

create index if not exists retail_sale_items_company_sale_idx
  on public.retail_sale_items (company_id, sale_id);

create index if not exists retail_sale_items_company_wine_idx
  on public.retail_sale_items (company_id, wine_id);

comment on table public.retail_sale_items is
  'Section 19 店頭販売伝票明細。wine情報・価格・TVA率は確定時のスナップショットで、後からwines/wine_list_settings/設定が変わっても過去伝票は変わらない。';


-- ------------------------------------------------------------
-- 5. RLS / GRANT
--
-- current_company_id() / current_user_role()（Section 14）を再利用。
--   retail_sale_settings : SELECT全role / INSERT・UPDATE ownerのみ
--   retail_sales         : SELECT全role / 書き込みpolicy無し（RPCのみ）
--   retail_sale_items    : SELECT全role / 書き込みpolicy無し（RPCのみ）
--   retail_sale_counters : policy・GRANT無し（RPCのみ）
-- DELETE policy はどのテーブルにも作らない。anonには一切権限を与えない。
-- ------------------------------------------------------------
alter table public.retail_sale_settings enable row level security;
alter table public.retail_sale_counters enable row level security;
alter table public.retail_sales enable row level security;
alter table public.retail_sale_items enable row level security;

revoke all on table public.retail_sale_settings from public, anon, authenticated;
revoke all on table public.retail_sale_counters from public, anon, authenticated;
revoke all on table public.retail_sales from public, anon, authenticated;
revoke all on table public.retail_sale_items from public, anon, authenticated;

grant select, insert, update on table public.retail_sale_settings to authenticated;
grant select on table public.retail_sales to authenticated;
grant select on table public.retail_sale_items to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'retail_sale_settings'
      and policyname = 'retail_sale_settings_select_company'
  ) then
    create policy "retail_sale_settings_select_company"
      on public.retail_sale_settings
      for select
      to authenticated
      using (company_id = public.current_company_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'retail_sale_settings'
      and policyname = 'retail_sale_settings_insert_owner'
  ) then
    create policy "retail_sale_settings_insert_owner"
      on public.retail_sale_settings
      for insert
      to authenticated
      with check (
        company_id = public.current_company_id()
        and public.current_user_role() = 'owner'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'retail_sale_settings'
      and policyname = 'retail_sale_settings_update_owner'
  ) then
    create policy "retail_sale_settings_update_owner"
      on public.retail_sale_settings
      for update
      to authenticated
      using (
        company_id = public.current_company_id()
        and public.current_user_role() = 'owner'
      )
      with check (
        company_id = public.current_company_id()
        and public.current_user_role() = 'owner'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'retail_sales'
      and policyname = 'retail_sales_select_company'
  ) then
    create policy "retail_sales_select_company"
      on public.retail_sales
      for select
      to authenticated
      using (company_id = public.current_company_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'retail_sale_items'
      and policyname = 'retail_sale_items_select_company'
  ) then
    create policy "retail_sale_items_select_company"
      on public.retail_sale_items
      for select
      to authenticated
      using (company_id = public.current_company_id());
  end if;
end;
$$;


-- ------------------------------------------------------------
-- 6. confirm_retail_sale()：販売確定（全明細を1トランザクションで）
--
-- p_items: [{"wine_id": uuid, "quantity": int,
--            "unit_price_ttc": number, "price_source": "LIST"|"MANUAL"}]
--   - 同じwine_idは1行にまとめて送ること（重複は拒否）。
--   - 金額（HT/TVA/合計）はクライアント値を使わずここで再計算する。
--   - TVA率はクライアントから受け取らず retail_sale_settings から読む。
--
-- 計算（行単位で丸め、合計は行の和）：
--   line_ttc = round(unit_ttc × qty, 2)
--   line_ht  = round(line_ttc / (1 + rate/100), 2)
--   line_vat = line_ttc − line_ht
--
-- 戻り値 already_existed = true は、同じ client_request_id の
-- 伝票が既に確定済みだった（再送）ことを示す。在庫は二重に減らない。
--
-- 制限：Section 8/9 は従来通りクライアントから直接INSERTするため、
-- この関数のwines行ロックはそれらとは直列化されない
-- （RPC同士の同時確定は直列化される）。
-- ------------------------------------------------------------
create or replace function public.confirm_retail_sale(
  p_client_request_id uuid,
  p_sale_date date,
  p_customer_name text,
  p_payment_method text,
  p_items jsonb
) returns table (
  sale_id uuid,
  sale_number text,
  total_ttc numeric,
  already_existed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_role text;
  v_user_id uuid;
  v_today date;
  v_existing record;
  v_item jsonb;
  v_wine_ids uuid[] := array[]::uuid[];
  v_wine_id uuid;
  v_quantity integer;
  v_unit_ttc numeric;
  v_price_source text;
  v_locked_count integer;
  v_vat_rate numeric;
  v_wine record;
  v_stock numeric;
  v_avg_cost numeric;
  v_year integer;
  v_counter integer;
  v_sale_id uuid;
  v_sale_number text;
  v_customer_name text;
  v_payment_method text;
  v_line_no integer := 0;
  v_line_ttc numeric;
  v_line_ht numeric;
  v_line_vat numeric;
  v_movement_id uuid;
  v_total_bottles integer := 0;
  v_total_ht numeric := 0;
  v_total_vat numeric := 0;
  v_total_ttc numeric := 0;
begin
  -- 6-1. 呼び出しユーザー・権限
  v_user_id := auth.uid();
  v_company_id := public.current_company_id();
  v_role := public.current_user_role();

  if v_user_id is null or v_company_id is null then
    raise exception 'RETAIL_NOT_AUTHENTICATED';
  end if;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception 'RETAIL_FORBIDDEN';
  end if;

  if p_client_request_id is null then
    raise exception 'RETAIL_REQUEST_ID_REQUIRED';
  end if;

  -- 6-2. 冪等化：同じ client_request_id の処理を直列化し、
  --      確定済みなら既存伝票をそのまま返す。
  perform pg_advisory_xact_lock(
    hashtextextended(
      'retail_sale:' || v_company_id::text || ':' || p_client_request_id::text,
      0
    )
  );

  select s.id, s.sale_number, s.total_ttc
    into v_existing
  from public.retail_sales s
  where s.company_id = v_company_id
    and s.client_request_id = p_client_request_id;

  if found then
    return query
      select v_existing.id, v_existing.sale_number, v_existing.total_ttc, true;
    return;
  end if;

  -- 6-3. ヘッダー入力の検証
  v_today := (now() at time zone 'Europe/Paris')::date;

  if p_sale_date is null then
    raise exception 'RETAIL_SALE_DATE_REQUIRED';
  end if;

  if p_sale_date > v_today then
    raise exception 'RETAIL_SALE_DATE_IN_FUTURE';
  end if;

  v_customer_name := nullif(trim(coalesce(p_customer_name, '')), '');

  if v_customer_name is not null and char_length(v_customer_name) > 200 then
    raise exception 'RETAIL_CUSTOMER_NAME_TOO_LONG';
  end if;

  v_payment_method := nullif(upper(trim(coalesce(p_payment_method, ''))), '');

  if v_payment_method is not null
    and v_payment_method not in ('CASH', 'CARD', 'OTHER')
  then
    raise exception 'RETAIL_INVALID_PAYMENT_METHOD';
  end if;

  -- 6-4. 明細の形式検証（DBアクセス前）
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'RETAIL_ITEMS_NOT_ARRAY';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'RETAIL_ITEMS_EMPTY';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'RETAIL_TOO_MANY_ITEMS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_wine_id := (v_item->>'wine_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      v_unit_ttc := (v_item->>'unit_price_ttc')::numeric;
    exception when others then
      raise exception 'RETAIL_INVALID_ITEM_FORMAT';
    end;

    if v_wine_id is null then
      raise exception 'RETAIL_INVALID_ITEM_FORMAT';
    end if;

    -- "1.5" のような小数はintegerキャストで丸められないよう元の値でも確認
    if v_quantity is null
      or v_quantity <= 0
      or (v_item->>'quantity')::numeric <> v_quantity
    then
      raise exception 'RETAIL_INVALID_QUANTITY';
    end if;

    -- 上限は numeric(12,2) の合計列が桁あふれしないための安全値
    if v_quantity > 9999 then
      raise exception 'RETAIL_INVALID_QUANTITY';
    end if;

    if v_unit_ttc is null
      or v_unit_ttc <= 0
      or v_unit_ttc > 999999.99
      or round(v_unit_ttc, 2) <> v_unit_ttc
    then
      raise exception 'RETAIL_INVALID_PRICE';
    end if;

    if v_wine_id = any(v_wine_ids) then
      raise exception 'RETAIL_DUPLICATE_WINE';
    end if;

    v_wine_ids := v_wine_ids || v_wine_id;
  end loop;

  -- 6-5. TVA率（サーバー側設定のみ）
  select rs.vat_rate_percent
    into v_vat_rate
  from public.retail_sale_settings rs
  where rs.company_id = v_company_id;

  if v_vat_rate is null then
    raise exception 'RETAIL_VAT_RATE_NOT_SET';
  end if;

  -- 6-6. 対象ワインを id 順にロック（同時確定の直列化・デッドロック回避）
  --      自社・active・未統合のワインのみ許可。
  select count(*)
    into v_locked_count
  from (
    select w.id
    from public.wines w
    where w.company_id = v_company_id
      and w.id = any(v_wine_ids)
      and w.is_active = true
      and w.merged_into_wine_id is null
    order by w.id
    for update
  ) locked;

  if v_locked_count <> array_length(v_wine_ids, 1) then
    raise exception 'RETAIL_WINE_NOT_AVAILABLE';
  end if;

  -- 6-7. 全明細の在庫チェック（ロック取得後の最新値。1件でも不足なら全体中止）
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_wine_id := (v_item->>'wine_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select coalesce(iv.current_quantity, 0)
      into v_stock
    from public.inventory_view iv
    where iv.company_id = v_company_id
      and iv.wine_id = v_wine_id;

    if coalesce(v_stock, 0) < v_quantity then
      raise exception 'RETAIL_INSUFFICIENT_STOCK:%', v_wine_id;
    end if;
  end loop;

  -- 6-8. 採番（全検証の後。失敗時はロールバックで欠番にならない）
  v_year := extract(year from p_sale_date)::integer;

  insert into public.retail_sale_counters as c (
    company_id, sale_year, last_number, updated_at
  ) values (
    v_company_id, v_year, 1, now()
  )
  -- RETURNS TABLE の出力列名との曖昧参照を避けるため制約名で指定
  on conflict on constraint retail_sale_counters_pkey
  do update set
    last_number = c.last_number + 1,
    updated_at = now()
  returning c.last_number into v_counter;

  -- lpadは長すぎる文字列を切り詰めるため、5桁を超えたらそのまま使う
  v_sale_number := 'VENTE-' || v_year::text || '-' ||
    case
      when v_counter > 99999 then v_counter::text
      else lpad(v_counter::text, 5, '0')
    end;

  -- 6-9. ヘッダーINSERT（合計は明細作成後にUPDATE）
  insert into public.retail_sales (
    company_id,
    sale_number,
    sale_year,
    sale_date,
    client_request_id,
    customer_name,
    status,
    payment_method,
    created_by
  ) values (
    v_company_id,
    v_sale_number,
    v_year,
    p_sale_date,
    p_client_request_id,
    v_customer_name,
    'CONFIRMED',
    v_payment_method,
    v_user_id
  )
  returning id into v_sale_id;

  -- 6-10. 明細ごとに SALE movement + 伝票明細
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_no := v_line_no + 1;
    v_wine_id := (v_item->>'wine_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_ttc := (v_item->>'unit_price_ttc')::numeric;
    v_price_source := case
      when upper(coalesce(v_item->>'price_source', '')) = 'MANUAL' then 'MANUAL'
      else 'LIST'
    end;

    select w.producer, w.wine_name, w.cuvee, w.vintage, w.bottle_size_cl
      into v_wine
    from public.wines w
    where w.id = v_wine_id
      and w.company_id = v_company_id;

    select iv.avg_cost_ht
      into v_avg_cost
    from public.inventory_view iv
    where iv.company_id = v_company_id
      and iv.wine_id = v_wine_id;

    v_line_ttc := round(v_unit_ttc * v_quantity, 2);
    v_line_ht := round(v_line_ttc / (1 + v_vat_rate / 100), 2);
    v_line_vat := v_line_ttc - v_line_ht;

    insert into public.stock_movements (
      company_id,
      wine_id,
      invoice_id,
      movement_type,
      quantity,
      unit_cost_ht,
      movement_date,
      notes
    ) values (
      v_company_id,
      v_wine_id,
      null,
      'SALE',
      -v_quantity,
      coalesce(v_avg_cost, 0),
      p_sale_date,
      'RETAIL_SALE:' || v_sale_number || ' | sale:' || v_sale_id::text
    )
    returning id into v_movement_id;

    insert into public.retail_sale_items (
      company_id,
      sale_id,
      line_no,
      wine_id,
      stock_movement_id,
      producer_snapshot,
      wine_name_snapshot,
      cuvee_snapshot,
      vintage_snapshot,
      bottle_size_cl_snapshot,
      quantity,
      vat_rate_percent,
      unit_price_ttc,
      unit_price_ht,
      line_total_ht,
      line_total_vat,
      line_total_ttc,
      price_source
    ) values (
      v_company_id,
      v_sale_id,
      v_line_no,
      v_wine_id,
      v_movement_id,
      v_wine.producer,
      v_wine.wine_name,
      v_wine.cuvee,
      v_wine.vintage::text,
      v_wine.bottle_size_cl,
      v_quantity,
      v_vat_rate,
      v_unit_ttc,
      round(v_unit_ttc / (1 + v_vat_rate / 100), 4),
      v_line_ht,
      v_line_vat,
      v_line_ttc,
      v_price_source
    );

    v_total_bottles := v_total_bottles + v_quantity;
    v_total_ht := v_total_ht + v_line_ht;
    v_total_vat := v_total_vat + v_line_vat;
    v_total_ttc := v_total_ttc + v_line_ttc;
  end loop;

  -- 6-11. 合計を確定
  update public.retail_sales s
  set
    total_bottles = v_total_bottles,
    total_ht = v_total_ht,
    total_vat = v_total_vat,
    total_ttc = v_total_ttc,
    updated_at = now()
  where s.id = v_sale_id;

  return query
    select v_sale_id, v_sale_number, v_total_ttc, false;
end;
$$;

comment on function public.confirm_retail_sale(uuid, date, text, text, jsonb) is
  'Section 19 店頭販売確定。owner/staffのみ。全明細のSALE movement・伝票・採番を1トランザクションで作成し、1件でも不正・在庫不足があれば全体を中止する。client_request_idで冪等。TVA率はretail_sale_settingsから読み、金額はサーバー側で再計算する。';

revoke all
  on function public.confirm_retail_sale(uuid, date, text, text, jsonb)
  from public, anon;

grant execute
  on function public.confirm_retail_sale(uuid, date, text, text, jsonb)
  to authenticated;


-- ------------------------------------------------------------
-- 7. cancel_retail_sale()：販売取消（ownerのみ・REVERSAL方式）
--
-- 伝票はDELETEせず status=CANCELLED に更新し、各明細のSALE movementに
-- 対してSection 9と同じ形式のREVERSAL行（数量プラス）をINSERTする。
--
-- 既にREVERSAL_OFが存在する明細（Section 9から個別取消済み等）は
-- 在庫が戻っているため二重にREVERSALせずスキップし、残りだけ取り消す
-- （skipped_lines で件数を返す）。これにより伝票が取消不能のまま
-- 残ることを防ぎ、最終的な在庫は常に正しくなる。
--
-- merge_wines() で統合された場合、SALE movement の wine_id はMasterへ
-- 付け替わっているため、REVERSAL は movement 側の現在の wine_id で作る
-- （retail_sale_items.wine_id との一致は要求しない）。
--
-- SALEの取消は在庫を増やす方向のため、マイナス在庫チェックは不要。
-- ------------------------------------------------------------
create or replace function public.cancel_retail_sale(
  p_sale_id uuid,
  p_reason text
) returns table (
  sale_id uuid,
  sale_number text,
  reversed_lines integer,
  skipped_lines integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_role text;
  v_user_id uuid;
  v_today date;
  v_sale record;
  v_item record;
  v_movement record;
  v_reason text;
  v_count integer := 0;
  v_skipped integer := 0;
begin
  v_user_id := auth.uid();
  v_company_id := public.current_company_id();
  v_role := public.current_user_role();

  if v_user_id is null or v_company_id is null then
    raise exception 'RETAIL_NOT_AUTHENTICATED';
  end if;

  if v_role is distinct from 'owner' then
    raise exception 'RETAIL_FORBIDDEN';
  end if;

  if p_sale_id is null then
    raise exception 'RETAIL_SALE_ID_REQUIRED';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'RETAIL_CANCEL_REASON_TOO_LONG';
  end if;

  -- 伝票行をロック（同じ伝票の同時取消を直列化）
  select s.id, s.sale_number, s.status
    into v_sale
  from public.retail_sales s
  where s.id = p_sale_id
    and s.company_id = v_company_id
  for update;

  if not found then
    raise exception 'RETAIL_SALE_NOT_FOUND';
  end if;

  if v_sale.status <> 'CONFIRMED' then
    raise exception 'RETAIL_SALE_ALREADY_CANCELLED';
  end if;

  v_today := (now() at time zone 'Europe/Paris')::date;

  for v_item in
    select i.stock_movement_id, i.wine_id, i.quantity
    from public.retail_sale_items i
    where i.sale_id = v_sale.id
      and i.company_id = v_company_id
    order by i.line_no
  loop
    select m.id, m.wine_id, m.movement_type, m.quantity, m.unit_cost_ht
      into v_movement
    from public.stock_movements m
    where m.id = v_item.stock_movement_id
      and m.company_id = v_company_id;

    if not found
      or v_movement.movement_type <> 'SALE'
      or v_movement.quantity <> -v_item.quantity
    then
      raise exception 'RETAIL_MOVEMENT_MISMATCH:%', v_item.stock_movement_id;
    end if;

    if exists (
      select 1
      from public.stock_movements r
      where r.company_id = v_company_id
        and r.movement_type = 'REVERSAL'
        and r.notes like 'REVERSAL_OF:' || v_movement.id::text || '%'
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.stock_movements (
      company_id,
      wine_id,
      invoice_id,
      movement_type,
      quantity,
      unit_cost_ht,
      movement_date,
      notes
    ) values (
      v_company_id,
      v_movement.wine_id,
      null,
      'REVERSAL',
      -v_movement.quantity,
      v_movement.unit_cost_ht,
      v_today,
      'REVERSAL_OF:' || v_movement.id::text ||
        ' | RETAIL_SALE_CANCEL:' || v_sale.sale_number
    );

    v_count := v_count + 1;
  end loop;

  if v_count + v_skipped = 0 then
    raise exception 'RETAIL_SALE_HAS_NO_ITEMS';
  end if;

  update public.retail_sales s
  set
    status = 'CANCELLED',
    cancelled_at = now(),
    cancelled_by = v_user_id,
    cancel_reason = v_reason,
    updated_at = now()
  where s.id = v_sale.id;

  return query
    select v_sale.id, v_sale.sale_number, v_count, v_skipped;
end;
$$;

comment on function public.cancel_retail_sale(uuid, text) is
  'Section 19 店頭販売取消。ownerのみ。伝票はDELETEせずCANCELLEDにし、各SALE movementへSection 9と同形式のREVERSAL(REVERSAL_OF:<id>)を1トランザクションで作成する。既にREVERSAL済みの明細は二重取消せずスキップする。merge_wines()後もmovement側のwine_idで正しく戻す。';

revoke all
  on function public.cancel_retail_sale(uuid, text)
  from public, anon;

grant execute
  on function public.cancel_retail_sale(uuid, text)
  to authenticated;


-- ============================================================
-- 適用後の確認クエリ（読み取りのみ・参考）
--
-- select tablename, policyname, cmd, roles
--   from pg_policies
--  where schemaname = 'public'
--    and tablename like 'retail_sale%'
--  order by tablename, policyname;
--
-- select table_name, privilege_type, grantee
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name like 'retail_sale%'
--    and grantee in ('anon', 'authenticated')
--  order by table_name, grantee, privilege_type;
--
-- select p.proname, p.prosecdef,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('confirm_retail_sale', 'cancel_retail_sale');
-- ============================================================
