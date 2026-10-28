-- QGApp 6.14 — Listagens independentes para A Minha Equipa / A Minha Turma
-- NÃO cria eventos, empenhamentos nem altera a disponibilidade.

create extension if not exists pgcrypto;

create table if not exists public.listagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contexto text not null check (contexto in ('EQUIPA','TURMA')),
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  descricao text,
  campo_extra_nome text,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.listagem_pessoas (
  id uuid primary key default gen_random_uuid(),
  listagem_id uuid not null references public.listagens(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  estado text not null default 'PENDENTE'
    check (estado in ('PENDENTE','FEITO','NAO_APLICAVEL')),
  valor_extra text,
  observacao text,
  concluido_em timestamptz,
  unique (listagem_id,pessoa_id)
);

create index if not exists idx_listagens_user_contexto
  on public.listagens(user_id,contexto,arquivada,atualizado_em desc);

create index if not exists idx_listagem_pessoas_listagem
  on public.listagem_pessoas(listagem_id);

alter table public.listagens enable row level security;
alter table public.listagem_pessoas enable row level security;

drop policy if exists listagens_select_owner on public.listagens;
drop policy if exists listagens_insert_owner on public.listagens;
drop policy if exists listagens_update_owner on public.listagens;
drop policy if exists listagens_delete_owner on public.listagens;

create policy listagens_select_owner
  on public.listagens for select to authenticated
  using (user_id = auth.uid());

create policy listagens_insert_owner
  on public.listagens for insert to authenticated
  with check (user_id = auth.uid());

create policy listagens_update_owner
  on public.listagens for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy listagens_delete_owner
  on public.listagens for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists listagem_pessoas_select_owner on public.listagem_pessoas;
drop policy if exists listagem_pessoas_insert_owner on public.listagem_pessoas;
drop policy if exists listagem_pessoas_update_owner on public.listagem_pessoas;
drop policy if exists listagem_pessoas_delete_owner on public.listagem_pessoas;

create policy listagem_pessoas_select_owner
  on public.listagem_pessoas for select to authenticated
  using (
    exists (
      select 1 from public.listagens l
      where l.id = listagem_id and l.user_id = auth.uid()
    )
  );

create policy listagem_pessoas_insert_owner
  on public.listagem_pessoas for insert to authenticated
  with check (
    exists (
      select 1 from public.listagens l
      where l.id = listagem_id and l.user_id = auth.uid()
    )
  );

create policy listagem_pessoas_update_owner
  on public.listagem_pessoas for update to authenticated
  using (
    exists (
      select 1 from public.listagens l
      where l.id = listagem_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listagens l
      where l.id = listagem_id and l.user_id = auth.uid()
    )
  );

create policy listagem_pessoas_delete_owner
  on public.listagem_pessoas for delete to authenticated
  using (
    exists (
      select 1 from public.listagens l
      where l.id = listagem_id and l.user_id = auth.uid()
    )
  );

revoke all on table public.listagens from anon;
revoke all on table public.listagem_pessoas from anon;
revoke all on table public.listagens from public;
revoke all on table public.listagem_pessoas from public;

grant select,insert,update,delete on table public.listagens to authenticated;
grant select,insert,update,delete on table public.listagem_pessoas to authenticated;
