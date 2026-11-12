-- ============================================================
-- Section 4「在庫確認済み（棚卸確認）」- スキーマ + RLS
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- 重要：このファイルはまだ適用しないでください
-- （レビュー・ユーザーの明示確認後に、手動で適用してください）。
--
-- 目的：
--   Section 4の現在庫一覧で、各wineを「在庫確認済み」として明示的に
--   記録し、「確認済みを非表示」ON時に未確認wineだけを表示する。
--
-- 設計方針：
--   - 1 company × 1 wine = 最新の確認状態1件（PK(company_id, wine_id)）。
--     行が存在する = 確認済み、行が無い = 未確認。
--     確認を取消す場合は行をDELETEする。
--   - 過去履歴を保持するstocktake session方式は今回は作らない。
--   - 数量変更(stock_movements / ADJUSTMENT)とは完全に分離する。
--     数量を変更しても自動で確認済みにはしない（明示操作のみ）。
--   - checked_at / checked_by はトリガーでDBのnow() / auth.uid()を強制セットする
--     （DB時刻を正とし、クライアントから時刻や他人のuser idを書き込めないようにするため）。
--
-- このファイル単体では既存データを一切変更しません：
--   - 新規テーブル・トリガー関数・トリガー・policyの作成のみ
--   - wines / stock_movements / inventory_view / merge_wines() には
--     一切触れない（merge連携は別対応。merge済みwineの古い行が
--     残っても、Section 4はis_active=true かつ
--     merged_into_wine_id is null のwineしか表示しないため問題ない）。
--
-- 全体をBEGIN/COMMITで囲み、途中で失敗した場合の部分適用を防ぐ。
-- 各DDLは冪等（再実行しても安全）を意識している。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. inventory_stocktake_checks
-- ------------------------------------------------------------
create table if not exists public.inventory_stocktake_checks (
  company_id uuid not null
    references public.companies(id),

  wine_id uuid not null
    references public.wines(id),

  checked_at timestamptz not null default now(),

  checked_by uuid null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_stocktake_checks_pkey
    primary key (company_id, wine_id)
);

comment on table public.inventory_stocktake_checks is
  'Section 4「在庫確認済み」。1 company × 1 wine = 最新の確認状態1件。行がある=確認済み、行が無い=未確認（取消はDELETE）。数量調整(stock_movements)とは独立した明示操作でのみ記録する。merge_wines()は現時点でこのテーブルを参照・更新しない。';

comment on column public.inventory_stocktake_checks.checked_at is
  '最後に「確認済み」にした日時。DB時刻を正とし、トリガーでINSERT/UPDATEごとにnow()が強制セットされる（クライアント送信値は無視）。';

comment on column public.inventory_stocktake_checks.checked_by is
  '最後に「確認済み」にしたユーザー(auth.uid())。トリガーでINSERT/UPDATEごとに強制セットされる。';


-- ------------------------------------------------------------
-- 2. checked_at / checked_by / updated_at を強制セットするトリガー
--
-- SECURITY INVOKERのまま（auth.uid()は呼び出しユーザーのJWTから
-- 取得される）。RLSのWITH CHECKはBEFORE ROWトリガー適用後の行に
-- 対して評価される。
-- ------------------------------------------------------------
create or replace function public.set_inventory_stocktake_checks_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.checked_at := now();
  new.checked_by := auth.uid();
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_stocktake_checks_set_audit
  on public.inventory_stocktake_checks;

create trigger inventory_stocktake_checks_set_audit
  before insert or update
  on public.inventory_stocktake_checks
  for each row
  execute function public.set_inventory_stocktake_checks_audit();


-- ------------------------------------------------------------
-- 3. RLS
--
-- 既存Section 14パターン（20260908_customer_roles.sql）と同じ
-- current_company_id() / current_user_role() を利用する。
-- SELECT：owner/staff/viewer全員（同一company）
-- INSERT/UPDATE/DELETE：owner/staffのみ（同一company）
-- INSERT/UPDATEはwine_idが同一companyのwines行であることも検証する
-- （wine_stock_alert_settingsと同じownership-checkパターン）。
-- anonには一切権限を与えない。
-- ------------------------------------------------------------
alter table public.inventory_stocktake_checks
  enable row level security;

revoke all
  on table public.inventory_stocktake_checks
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.inventory_stocktake_checks
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_stocktake_checks'
      and policyname = 'inventory_stocktake_checks_select_company'
  ) then
    create policy "inventory_stocktake_checks_select_company"
      on public.inventory_stocktake_checks
      for select
      to authenticated
      using (
        company_id = public.current_company_id()
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_stocktake_checks'
      and policyname = 'inventory_stocktake_checks_insert_company_role'
  ) then
    create policy "inventory_stocktake_checks_insert_company_role"
      on public.inventory_stocktake_checks
      for insert
      to authenticated
      with check (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
        and exists (
          select 1
          from public.wines w
          where w.id = public.inventory_stocktake_checks.wine_id
            and w.company_id = public.inventory_stocktake_checks.company_id
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_stocktake_checks'
      and policyname = 'inventory_stocktake_checks_update_company_role'
  ) then
    create policy "inventory_stocktake_checks_update_company_role"
      on public.inventory_stocktake_checks
      for update
      to authenticated
      using (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
      )
      with check (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
        and exists (
          select 1
          from public.wines w
          where w.id = public.inventory_stocktake_checks.wine_id
            and w.company_id = public.inventory_stocktake_checks.company_id
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_stocktake_checks'
      and policyname = 'inventory_stocktake_checks_delete_company_role'
  ) then
    create policy "inventory_stocktake_checks_delete_company_role"
      on public.inventory_stocktake_checks
      for delete
      to authenticated
      using (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
      );
  end if;
end;
$$;


notify pgrst, 'reload schema';

commit;
