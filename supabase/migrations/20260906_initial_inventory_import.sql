-- ============================================================
-- Section 10「初期在庫インポート（運営者専用）」- スキーマ + アトミックRPC
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- このファイルはまだ適用しないでください（ユーザーの明示確認後に適用）。
--
-- このmigration単体では既存データを一切変更しません。
-- 実際に初期在庫が登録されるのは、運営者が
-- Admin API (/api/admin/inventory-import/commit) 経由で
-- admin_commit_initial_inventory() をRPC呼び出ししたときだけです。
-- このRPCはservice_roleからのみ実行可能です。
--
-- 2026-09-06 安全性レビュー後の修正版：
--   1. quantity > 0 をRPC側でも必須化（0以下・null・非整数を拒否）
--   2. matched_wine_idは is_active=true かつ merged_into_wine_id is null
--      のワインだけ許可（統合済み/無効化済みワインへの紐付けを禁止）
--   3. inventory_import_batchesのREVOKEにPUBLICを明示
--   4. imported_by を NOT NULL 化 + RPC側でもnullを拒否
--   5. source_file_hash を NOT NULL 化 + 64桁hex形式を検証
-- ============================================================

-- ------------------------------------------------------------
-- 1. インポートバッチ記録テーブル
--
-- 「どの会社に、いつ、どのファイルから、何件」初期在庫を
-- 入れたかを記録する。運営Admin API（service_role）専用。
-- RLSは有効化するがpolicyは作らない
-- （= service_role以外は select/insert 一切不可）。
--
-- imported_by / source_file_hash はどちらも監査・二重import防止に
-- 必須の情報のため NOT NULL とする
-- （commit APIは常にBearer tokenで検証済みのadmin user.idと、
--   アップロードファイルのSHA-256 hashを渡す設計）。
-- ------------------------------------------------------------
create table if not exists public.inventory_import_batches (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  source_filename text,
  source_file_hash text not null,

  source_row_count integer not null default 0,
  recognized_wine_count integer not null default 0,
  unique_wine_count integer not null default 0,
  total_bottles numeric not null default 0,

  imported_by uuid not null
    references auth.users(id),

  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint inventory_import_batches_hash_format_check
    check (
      source_file_hash ~ '^[0-9a-fA-F]{64}$'
    )
);

comment on table public.inventory_import_batches is
  '運営者専用の初期在庫インポート履歴。service_role(Admin API)からのみ操作する。';

comment on column public.inventory_import_batches.source_file_hash is
  'アップロードされたExcel/CSVのSHA-256 hash（64桁hex、NOT NULL）。同一company+hashの完了済みバッチが既にあれば、二重importとして拒否するために使う。';

comment on column public.inventory_import_batches.imported_by is
  '実行した運営者のauth.users.id。NOT NULL。Admin APIはBearer tokenを検証して得たuser.idのみをここへ渡し、request bodyの値は使用しない。';

alter table public.inventory_import_batches
  enable row level security;

-- 意図的にpolicyを作らない。
-- service_role はRLSを常にバイパスするため、
-- Admin API (service_role) だけがこのテーブルを読み書きできる。
-- PUBLIC / anon / authenticated からは select/insert/update/delete いずれも不可。

revoke all
  on table public.inventory_import_batches
  from public, anon, authenticated;

grant select, insert, update
  on public.inventory_import_batches
  to service_role;

-- 同一会社・同一ファイルの「完了済み」インポートは1回だけに制限する。
--
-- admin_commit_initial_inventory()はbatch作成～completed_at更新までを
-- 1つのトランザクションとして実行し、途中で失敗すればinsertした
-- batch行ごとロールバックされる。そのため、コミット後に残る行は
-- 常にcompleted_atが設定済みであり、このindexは実質的に
-- 「company_id + source_file_hashの組で常に一意」という制約として働く。
-- source_file_hashがNOT NULLになったため、partial indexにする理由は
-- 無くなったが、将来の設計変更に対する保険として
-- completed_at is not null の条件は残す。
create unique index if not exists
  inventory_import_batches_company_hash_completed_unique
  on public.inventory_import_batches (company_id, source_file_hash)
  where completed_at is not null;


-- ------------------------------------------------------------
-- 2. 初期在庫一括登録RPC。
--
-- 1回の呼び出し全体が1つのDBトランザクションとして実行される。
-- 途中で例外が発生した場合、plpgsql関数内の変更はすべて
-- 自動的にロールバックされる（部分インポートは残らない）。
--
-- 検証内容：
--   - quantity は必ず 1以上の整数（0・負数・null・小数はすべて拒否）
--   - matched_wine_idは同一company_id かつ is_active=true かつ
--     merged_into_wine_id is null のワインのみ許可
--   - imported_by は必須（nullなら拒否）
--   - source_file_hash は必須かつ64桁hex形式のみ許可
-- ------------------------------------------------------------
create or replace function public.admin_commit_initial_inventory(
  p_company_id uuid,
  p_source_filename text,
  p_source_file_hash text,
  p_source_row_count integer,
  p_recognized_wine_count integer,
  p_imported_by uuid,
  p_rows jsonb
) returns table (
  batch_id uuid,
  wine_count integer,
  total_bottles numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_wine_id uuid;
  v_matched_wine_id uuid;
  v_quantity numeric;
  v_unit_cost_ht numeric;
  v_wine_count integer := 0;
  v_total_bottles numeric := 0;
  v_notes text;
begin
  if p_company_id is null then
    raise exception 'company_id is required';
  end if;

  if p_imported_by is null then
    raise exception 'imported_by is required (verified admin user id)';
  end if;

  if p_source_file_hash is null
    or trim(p_source_file_hash) = ''
  then
    raise exception 'source_file_hash is required';
  end if;

  if p_source_file_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception
      'source_file_hash must be a 64-character hex SHA-256 digest';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'rows is empty; nothing to import';
  end if;

  -- 同一会社・同一ファイルの完了済みインポートが既にある場合は拒否する。
  if exists (
    select 1
    from public.inventory_import_batches b
    where b.company_id = p_company_id
      and b.source_file_hash = p_source_file_hash
      and b.completed_at is not null
  ) then
    raise exception
      'This file has already been imported for this company (duplicate source_file_hash).';
  end if;

  insert into public.inventory_import_batches (
    company_id,
    source_filename,
    source_file_hash,
    source_row_count,
    recognized_wine_count,
    unique_wine_count,
    total_bottles,
    imported_by
  ) values (
    p_company_id,
    p_source_filename,
    p_source_file_hash,
    coalesce(p_source_row_count, 0),
    coalesce(p_recognized_wine_count, 0),
    jsonb_array_length(p_rows),
    0,
    p_imported_by
  )
  returning id into v_batch_id;

  for v_row in
    select * from jsonb_array_elements(p_rows)
  loop
    v_quantity := (v_row->>'quantity')::numeric;

    -- quantity は必ず1以上の整数。0・負数・nullはすべて拒否する。
    -- クライアント側のSKIP判定だけに依存しない。
    if v_quantity is null or v_quantity <= 0 then
      raise exception
        'Invalid quantity: quantity must be greater than zero (producer=%, wine_name=%, quantity=%)',
        v_row->>'producer', v_row->>'wine_name', v_row->>'quantity';
    end if;

    if v_quantity <> floor(v_quantity) then
      raise exception
        'Invalid quantity: quantity must be a whole number (producer=%, wine_name=%, quantity=%)',
        v_row->>'producer', v_row->>'wine_name', v_row->>'quantity';
    end if;

    v_unit_cost_ht := nullif(v_row->>'unit_cost_ht', '')::numeric;

    v_matched_wine_id := nullif(v_row->>'matched_wine_id', '')::uuid;

    if v_matched_wine_id is not null then
      -- matched_wine_idが本当にこのcompanyの「有効な」ワインかを
      -- DB側でも検証する。統合済み(is_active=false)・統合先が
      -- 設定されている(merged_into_wine_id is not null)ワインは拒否する。
      -- クライアントが送ってきたcompany_idを鵜呑みにしない。
      if not exists (
        select 1 from public.wines w
        where w.id = v_matched_wine_id
          and w.company_id = p_company_id
          and w.is_active = true
          and w.merged_into_wine_id is null
      ) then
        raise exception
          'matched_wine_id % does not belong to company %, or refers to an inactive/merged wine',
          v_matched_wine_id, p_company_id;
      end if;

      v_wine_id := v_matched_wine_id;
    else
      insert into public.wines (
        company_id,
        producer,
        wine_name,
        cuvee,
        color,
        vintage,
        bottle_size_cl,
        alcohol_percent
      ) values (
        p_company_id,
        coalesce(nullif(trim(v_row->>'producer'), ''), 'UNKNOWN PRODUCER'),
        coalesce(nullif(trim(v_row->>'wine_name'), ''), 'UNKNOWN WINE'),
        nullif(trim(v_row->>'cuvee'), ''),
        nullif(trim(v_row->>'color'), ''),
        nullif(trim(v_row->>'vintage'), ''),
        nullif(v_row->>'bottle_size_cl', '')::integer,
        nullif(trim(v_row->>'alcohol_percent'), '')
      )
      returning id into v_wine_id;
    end if;

    v_notes := 'INITIAL_IMPORT:' || v_batch_id::text
      || ' | file:' || coalesce(p_source_filename, 'unknown')
      || ' | sheet:' || coalesce(v_row->>'source_sheet', '');

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
      p_company_id,
      v_wine_id,
      null,
      'INITIAL_IMPORT',
      v_quantity,
      v_unit_cost_ht,
      current_date,
      v_notes
    );

    v_wine_count := v_wine_count + 1;
    v_total_bottles := v_total_bottles + v_quantity;
  end loop;

  update public.inventory_import_batches
  set
    unique_wine_count = v_wine_count,
    total_bottles = v_total_bottles,
    completed_at = now()
  where id = v_batch_id;

  return query
    select v_batch_id, v_wine_count, v_total_bottles;
end;
$$;

comment on function public.admin_commit_initial_inventory is
  '運営者専用の初期在庫一括登録RPC。service_roleからのみ実行可能。1回の呼び出し全体が1トランザクションで、途中で失敗すると全体（batch行を含む）がロールバックされる。quantityは1以上の整数のみ許可し、matched_wine_idはactiveかつ未統合のワインのみ許可する。stock_movements.movement_type=INITIAL_IMPORTとして登録し、既存のPURCHASE/SALE/ADJUSTMENT/REVERSALロジックには一切触れない。';

revoke all
  on function public.admin_commit_initial_inventory
  from public, anon, authenticated;

grant execute
  on function public.admin_commit_initial_inventory
  to service_role;


notify pgrst, 'reload schema';
