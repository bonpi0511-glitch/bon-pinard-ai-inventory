-- ============================================================
-- Section 11「顧客会社管理（運営者専用）」- スキーマ + アトミックRPC
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- 重要：このファイルはまだ適用しないでください
-- （ユーザーの明示確認後に適用）。
--
-- このファイル単体では既存データを一切変更しません
-- （新規テーブル・新規view・新規関数の作成のみ）。
-- 実際に顧客会社が作成されるのは、運営者が
-- Admin API (/api/admin/customers, POST) 経由で
-- admin_create_customer_company() をRPC呼び出ししたときだけです。
-- このRPCはservice_roleからのみ実行可能です。
--
-- 【重要な適用順序】
-- このmigrationは以下2つが先に適用されていることを前提とする：
--   1. 20260906_repair_wine_merge_schema.sql
--      （admin_customer_summary_viewが wines.is_active を参照するため）
--   2. 20260906_initial_inventory_import.sql
--      （admin_customer_summary_viewが public.inventory_import_batches
--        を参照するため）
-- これらが未適用の状態でこのファイルを適用しようとすると、
-- CREATE VIEW時点で「列/テーブルが存在しない」エラーになり、
-- 安全に失敗します（部分適用にはなりません）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. company_admin_metadata
--
-- 顧客ごとの営業・契約・導入状況を保持する運営専用テーブル。
-- companies本体には列を追加しない（1:0または1:1の別テーブル）。
-- ------------------------------------------------------------
create table if not exists public.company_admin_metadata (
  company_id uuid primary key
    references public.companies(id)
    on delete cascade,

  onboarding_status text not null default 'NEW'
    check (
      onboarding_status in (
        'NEW',
        'WAITING_EXCEL',
        'EXCEL_RECEIVED',
        'ANALYZING',
        'READY_TO_IMPORT',
        'IMPORTED',
        'ACTIVE'
      )
    ),

  contract_status text not null default 'PROSPECT'
    check (
      contract_status in (
        'PROSPECT',
        'TRIAL',
        'ACTIVE',
        'PAUSED',
        'CANCELLED'
      )
    ),

  initial_fee_eur numeric,
  monthly_fee_eur numeric,
  plan_name text,
  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_admin_metadata is
  '運営者専用の顧客管理情報（営業・契約・導入状況）。一般ユーザーには一切公開しない。service_role(Admin API)からのみ操作する。';

comment on column public.company_admin_metadata.onboarding_status is
  '導入状況: NEW/WAITING_EXCEL/EXCEL_RECEIVED/ANALYZING/READY_TO_IMPORT/IMPORTED/ACTIVE。Section 10のinventory_import_batchesとは連動して自動更新されない（運営者が手動で管理する）。';

comment on column public.company_admin_metadata.contract_status is
  '契約状況: PROSPECT/TRIAL/ACTIVE/PAUSED/CANCELLED。会社の削除は行わず、契約終了時はCANCELLEDにする運用とする。';

alter table public.company_admin_metadata
  enable row level security;

-- 意図的にpolicyを作らない。service_role以外（anon/authenticated含む）は
-- select/insert/update/delete いずれも不可。
revoke all
  on table public.company_admin_metadata
  from public, anon, authenticated;

grant select, insert, update
  on public.company_admin_metadata
  to service_role;

-- updated_atを自動更新する（このテーブル専用の新規トリガー。
-- 既存テーブルには一切触れない）。
create or replace function public.set_company_admin_metadata_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_admin_metadata_set_updated_at
  on public.company_admin_metadata;

create trigger company_admin_metadata_set_updated_at
  before update on public.company_admin_metadata
  for each row
  execute function public.set_company_admin_metadata_updated_at();


-- ------------------------------------------------------------
-- 2. admin_customer_summary_view
--
-- Section 11の顧客一覧を1回のSELECTで取得するための集計view。
-- N+1クエリを避けるため、wines / inventory_view /
-- inventory_import_batches / company_admin_metadata を
-- company単位で事前に集約してからJOINする。
--
-- service_role専用（RLSを持つテーブルへのJOINが含まれるため、
-- 一般ロールがこのviewを直接SELECTできないようREVOKE/GRANTで制限する）。
-- ------------------------------------------------------------
create or replace view public.admin_customer_summary_view as
select
  c.id as company_id,
  c.name as company_name,
  c.created_at as company_created_at,

  coalesce(wine_counts.wine_count, 0) as wine_count,
  coalesce(inv.current_bottles, 0) as current_bottles,
  inv.last_stock_movement_date,

  coalesce(batch_counts.batch_count, 0)
    as initial_import_batch_count,
  latest_batch.completed_at
    as latest_initial_import_at,
  latest_batch.source_filename
    as latest_initial_import_filename,
  latest_batch.unique_wine_count
    as latest_initial_import_unique_wines,
  latest_batch.total_bottles
    as latest_initial_import_total_bottles,

  coalesce(m.onboarding_status, 'NEW')
    as onboarding_status,
  coalesce(m.contract_status, 'PROSPECT')
    as contract_status,
  m.plan_name,
  m.initial_fee_eur,
  m.monthly_fee_eur,
  m.internal_notes,
  m.updated_at as metadata_updated_at

from public.companies c

left join (
  select
    company_id,
    count(*) as wine_count
  from public.wines
  where is_active = true
  group by company_id
) wine_counts
  on wine_counts.company_id = c.id

left join (
  select
    company_id,
    sum(current_quantity) as current_bottles,
    max(last_movement_date) as last_stock_movement_date
  from public.inventory_view
  group by company_id
) inv
  on inv.company_id = c.id

left join (
  select
    company_id,
    count(*) as batch_count
  from public.inventory_import_batches
  where completed_at is not null
  group by company_id
) batch_counts
  on batch_counts.company_id = c.id

left join (
  select distinct on (company_id)
    company_id,
    source_filename,
    unique_wine_count,
    total_bottles,
    completed_at
  from public.inventory_import_batches
  where completed_at is not null
  order by company_id, completed_at desc
) latest_batch
  on latest_batch.company_id = c.id

left join public.company_admin_metadata m
  on m.company_id = c.id;

comment on view public.admin_customer_summary_view is
  'Section 11 顧客会社一覧用の集計view。service_role専用（一般ロールはREVOKE済み）。company_admin_metadataやinventory_import_batchesなどRLS保護されたテーブルを含むため、直接公開しない。';

revoke all
  on public.admin_customer_summary_view
  from public, anon, authenticated;

grant select
  on public.admin_customer_summary_view
  to service_role;


-- ------------------------------------------------------------
-- 3. admin_create_customer_company(): 新規顧客会社作成RPC
--
-- companies作成 + company_admin_metadata作成を1トランザクションで
-- 行う。途中で例外が発生した場合はcompaniesへのINSERTを含め
-- すべてロールバックされ、company行だけが作られてmetadataが
-- 無い、という中途半端な状態を防ぐ。
--
-- 同名会社の重複チェックはここでは行わない（Admin API側で
-- 事前に検索し、運営者に警告・確認させたうえで呼び出す設計）。
-- ------------------------------------------------------------
create or replace function public.admin_create_customer_company(
  p_company_name text,
  p_plan_name text default null,
  p_initial_fee_eur numeric default null,
  p_monthly_fee_eur numeric default null,
  p_internal_notes text default null
) returns table (
  company_id uuid,
  company_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_name text := trim(coalesce(p_company_name, ''));
begin
  if v_name = '' then
    raise exception 'Company name is required.';
  end if;

  if length(v_name) > 200 then
    raise exception 'Company name is too long (max 200 characters).';
  end if;

  insert into public.companies (name)
  values (v_name)
  returning id into v_company_id;

  insert into public.company_admin_metadata (
    company_id,
    plan_name,
    initial_fee_eur,
    monthly_fee_eur,
    internal_notes
  ) values (
    v_company_id,
    nullif(trim(coalesce(p_plan_name, '')), ''),
    p_initial_fee_eur,
    p_monthly_fee_eur,
    nullif(trim(coalesce(p_internal_notes, '')), '')
  );

  return query
    select c.id, c.name, c.created_at
    from public.companies c
    where c.id = v_company_id;
end;
$$;

comment on function public.admin_create_customer_company is
  '運営者専用の新規顧客会社作成RPC。service_roleからのみ実行可能。companies作成とcompany_admin_metadata作成を1トランザクションで行い、途中で失敗すれば両方ロールバックされる。';

revoke all
  on function public.admin_create_customer_company
  from public, anon, authenticated;

grant execute
  on function public.admin_create_customer_company
  to service_role;


notify pgrst, 'reload schema';
