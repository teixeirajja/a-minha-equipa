-- QGApp 6.13 — Notas e Listas
-- Executar uma vez no Supabase SQL Editor.
-- Cria armazenamento pessoal sincronizado com RLS por utilizador.

begin;

create table if not exists public.notas_listas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('NOTA','LISTA')),
  titulo text not null check (char_length(trim(titulo)) between 1 and 160),
  conteudo text not null default '',
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens)='array'),
  fixada boolean not null default false,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists notas_listas_user_updated_idx
  on public.notas_listas (user_id, arquivada, fixada desc, atualizado_em desc);

alter table public.notas_listas enable row level security;
alter table public.notas_listas force row level security;

drop policy if exists qgapp_owner_notas_listas on public.notas_listas;
create policy qgapp_owner_notas_listas
on public.notas_listas
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.notas_listas from anon, public;
revoke all on table public.notas_listas from authenticated;
grant select, insert, update, delete on table public.notas_listas to authenticated;

commit;
