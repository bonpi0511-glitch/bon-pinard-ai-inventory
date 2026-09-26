create table if not exists public.wine_duplicate_decisions (
  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  wine_id_a uuid not null
    references public.wines(id)
    on delete cascade,

  wine_id_b uuid not null
    references public.wines(id)
    on delete cascade,

  decision text not null
    default 'DIFFERENT'
    check (
      decision in ('DIFFERENT')
    ),

  decided_by uuid not null
    default auth.uid(),

  decided_at timestamptz not null
    default now(),

  constraint wine_duplicate_decisions_different_wines_check
    check (
      wine_id_a <> wine_id_b
    ),

  constraint wine_duplicate_decisions_sorted_pair_check
    check (
      wine_id_a::text < wine_id_b::text
    ),

  constraint wine_duplicate_decisions_company_pair_pk
    primary key (
      company_id,
      wine_id_a,
      wine_id_b
    )
);

alter table public.wine_duplicate_decisions
  enable row level security;


drop policy if exists
  "wine_duplicate_decisions_select_company"
  on public.wine_duplicate_decisions;

create policy
  "wine_duplicate_decisions_select_company"
  on public.wine_duplicate_decisions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id =
          wine_duplicate_decisions.company_id
    )
  );


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
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id =
          wine_duplicate_decisions.company_id
    )
  );


revoke all
  on public.wine_duplicate_decisions
  from anon;

grant select, insert, delete
  on public.wine_duplicate_decisions
  to authenticated;


notify pgrst, 'reload schema';
