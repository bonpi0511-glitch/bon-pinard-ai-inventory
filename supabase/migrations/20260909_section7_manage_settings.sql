-- ============================================================
-- Section 7 MANAGE対応 + companies SELECT policy正式記録
--
-- 2026-09-09
--
-- このmigrationは以下を行う：
-- 1. wine_list_settingsへのowner/staff限定INSERT policy追加
-- 2. 本番へ手動適用済みのcompanies_select_own_companyを
--    migration履歴として正式記録
--
-- wine_classification_memoryへのplaceholder INSERTは行わない。
-- wine_list_viewも変更しない。
--
-- 全体をトランザクションで囲み、途中で失敗した場合に
-- GRANTだけ適用される等の部分適用を防ぐ。
-- 全てのDDLは冪等（再実行しても安全）。
-- 既存policyは一切DROPしない。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- A. wine_list_settings: RLSを有効化する（既に有効なら何もしない）。
-- ------------------------------------------------------------
alter table public.wine_list_settings
  enable row level security;


-- ------------------------------------------------------------
-- B. authenticatedへINSERT実行権限を付与する。
--    行単位の制限は下のC.のpolicyが担う。
-- ------------------------------------------------------------
grant insert
  on table public.wine_list_settings
  to authenticated;


-- ------------------------------------------------------------
-- C. owner/staff限定のINSERT policyを追加する。
--    既存のSELECT/UPDATE policyには触れない。
--    同名policyが既にあればスキップする。
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_list_settings'
      and policyname = 'wine_list_settings_insert_company_role'
  ) then
    create policy "wine_list_settings_insert_company_role"
      on public.wine_list_settings
      for insert
      to authenticated
      with check (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
      );
  end if;
end;
$$;


-- ------------------------------------------------------------
-- D. companies: 本番へ手動適用済みのRLS/policyを正式記録する。
--    既存policyはDROPしない。
--    INSERT/UPDATE/DELETE policyは追加しない（SELECTのみ）。
-- ------------------------------------------------------------
alter table public.companies
  enable row level security;

grant select
  on table public.companies
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'companies_select_own_company'
  ) then
    create policy "companies_select_own_company"
      on public.companies
      for select
      to authenticated
      using (
        id = public.current_company_id()
      );
  end if;
end;
$$;


notify pgrst, 'reload schema';

commit;
