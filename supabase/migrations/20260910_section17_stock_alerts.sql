-- ============================================================
-- Section 17「在庫アラート / 補充候補」- スキーマ + RLS
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- 重要：このファイルはまだ適用しないでください
-- （ユーザーの明示確認後に、手動で適用してください）。
--
-- 前提（2026-09-10 本番確認済み）：
--   inventory_view は wines を母体に stock_movements を LEFT JOIN し、
--   COALESCE(SUM(sm.quantity), 0) を current_quantity として返す。
--   そのため stock_movements が一度も無い wine・SUM が 0 の wine も
--   inventory_view の行として存在し得る。ただし inventory_view 自体には
--   is_active / merged_into_wine_id の条件が無いため、Section 17の
--   アプリ側では inventory_view だけを母体にせず、
--   wines(is_active=true, merged_into_wine_id is null) を母体にして
--   inventory_view をLEFT JOIN相当でmergeする（このmigrationとは
--   別に、アプリ側のfetchロジックで対応する）。
--
-- このファイル単体では既存データを一切変更しません：
--   - 新規テーブルの作成のみ（既存 wines / stock_movements /
--     inventory_view 等には一切触れない）
--   - 既存751件(BON PINARD SAS時点)を含む、いかなる既存wineへも
--     settings行を一括生成しない（行が無い=未設定として扱う設計）
--   - merge_wines()は今回変更しない。to/from統合ルールの検討は
--     10節の議論を踏まえ、Section17本体・実機テスト後に
--     別migrationとして対応する（本番稼働中RPCの改修は
--     Section17本体より高リスクなため、今回のスコープに含めない）。
--
-- 全体をBEGIN/COMMITで囲み、途中で失敗した場合の部分適用を防ぐ。
-- 各DDLは冪等（再実行しても安全）を意識している。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. wine_stock_alert_settings
--
-- companyごと・wineごとに、最低在庫数(min_quantity)・目標在庫数
-- (target_quantity)・アラート有効/無効(alert_enabled)を保持する。
--
-- 行が存在しないwineは「未設定」として扱い、OUT OF STOCK/LOW STOCK
-- 判定の対象にしない（新規顧客の全wineがいきなり警告状態になるのを
-- 防ぐため）。INITIAL_IMPORT・通常仕入のいずれでもこのテーブルへの
-- placeholder行は作らない（顧客が必要なwineだけ個別に設定する）。
-- ------------------------------------------------------------
create table if not exists public.wine_stock_alert_settings (
  company_id uuid not null
    references public.companies(id),

  wine_id uuid not null
    references public.wines(id),

  min_quantity numeric not null default 0
    check (min_quantity >= 0),

  target_quantity numeric
    check (
      target_quantity is null
      or target_quantity >= 0
    ),

  alert_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wine_stock_alert_settings_pkey
    primary key (company_id, wine_id),

  -- 「target < min」の不正な組み合わせをDB側でも拒否する
  -- （アプリ側でも事前検証するが、二重の安全策として採用）。
  -- 新規テーブルのため既存データとの互換性問題は無い。
  constraint wine_stock_alert_settings_target_gte_min_check
    check (
      target_quantity is null
      or target_quantity >= min_quantity
    )
);

comment on table public.wine_stock_alert_settings is
  'Section 17「在庫アラート / 補充候補」用の、wineごとの閾値設定。行が存在しないwineは「未設定」として扱い、OUT OF STOCK/LOW STOCK判定の対象にしない。INITIAL_IMPORT・通常仕入のいずれでもplaceholder行は作らない（顧客が必要なwineだけ個別に設定する）。merge_wines()は現時点でこのテーブルを一切参照・更新しない（統合時の扱いは未実装、別migrationで対応予定）。';

comment on column public.wine_stock_alert_settings.min_quantity is
  'alert_enabled=trueのとき、0 < current_quantity <= min_quantityでLOW STOCK。current_quantity<=0は常にOUT OF STOCK。';

comment on column public.wine_stock_alert_settings.target_quantity is
  '補充候補数(recommended_order_quantity = max(target_quantity - current_quantity, 0))の計算に使う目標在庫数。NULLの場合、補充候補は「未設定」として扱い、min_quantityとの差を代わりに使わない。';

comment on column public.wine_stock_alert_settings.alert_enabled is
  'false(既定)の間は、min_quantity/target_quantityが入力済みでもOUT OF STOCK/LOW STOCK判定を行わない（閾値だけ先に決めて、後で有効化する運用に対応するため）。';


-- ------------------------------------------------------------
-- 2. RLS
--
-- 既存Section 14パターン（20260908_customer_roles.sql）と同じ
-- current_company_id() / current_user_role() を利用する。
-- SELECTはowner/staff/viewer全員、INSERT/UPDATEはowner/staffのみ。
-- DELETE policyは意図的に作らない
-- （RLSはデフォルト拒否のため、ownerであってもDELETE不可のまま。
--   アラートを止める場合はalert_enabled=falseを使う運用とする）。
-- ------------------------------------------------------------
alter table public.wine_stock_alert_settings
  enable row level security;

revoke all
  on table public.wine_stock_alert_settings
  from public, anon, authenticated;

grant select, insert, update
  on table public.wine_stock_alert_settings
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_stock_alert_settings'
      and policyname = 'wine_stock_alert_settings_select_company'
  ) then
    create policy "wine_stock_alert_settings_select_company"
      on public.wine_stock_alert_settings
      for select
      to authenticated
      using (
        company_id = public.current_company_id()
      );
  end if;
end;
$$;

-- INSERT: owner/staffのみ。wine_idが同じcompanyの
-- wines行であることもDB側で検証する
-- （wine_duplicate_decisions_insert_companyと同じ
--   ownership-checkパターンを踏襲）。
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_stock_alert_settings'
      and policyname = 'wine_stock_alert_settings_insert_company_role'
  ) then
    create policy "wine_stock_alert_settings_insert_company_role"
      on public.wine_stock_alert_settings
      for insert
      to authenticated
      with check (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
        and exists (
          select 1
          from public.wines w
          where w.id = public.wine_stock_alert_settings.wine_id
            and w.company_id = public.wine_stock_alert_settings.company_id
        )
      );
  end if;
end;
$$;

-- UPDATE: owner/staffのみ。同上のownership-check。
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_stock_alert_settings'
      and policyname = 'wine_stock_alert_settings_update_company_role'
  ) then
    create policy "wine_stock_alert_settings_update_company_role"
      on public.wine_stock_alert_settings
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
          where w.id = public.wine_stock_alert_settings.wine_id
            and w.company_id = public.wine_stock_alert_settings.company_id
        )
      );
  end if;
end;
$$;


notify pgrst, 'reload schema';

commit;
