-- Méridien : le passeport des pays trouvés suit le compte, d'un appareil à l'autre.
-- Se colle telle quelle dans l'éditeur SQL du projet, après les migrations précédentes. Peut être relancée sans risque.

create table if not exists public.passport_stamps (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  code text not null check (code ~ '^[A-Z]{2}$'),
  -- nombre de fois où le pays a été trouvé, première et dernière fois
  n integer not null default 1 check (n between 1 and 1000000),
  first_at timestamptz not null,
  last_at timestamptz not null,
  games text[] not null default '{}' check (cardinality(games) <= 60),
  primary key (user_id, code)
);

alter table public.passport_stamps enable row level security;

-- Chacun ne lit et n'écrit que son propre passeport.
drop policy if exists "Lire son passeport" on public.passport_stamps;
create policy "Lire son passeport" on public.passport_stamps for select using ((select auth.uid()) = user_id);
drop policy if exists "Tamponner son passeport" on public.passport_stamps;
create policy "Tamponner son passeport" on public.passport_stamps for insert with check ((select auth.uid()) = user_id);
drop policy if exists "Mettre à jour son passeport" on public.passport_stamps;
create policy "Mettre à jour son passeport" on public.passport_stamps for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Effacer son passeport" on public.passport_stamps;
create policy "Effacer son passeport" on public.passport_stamps for delete using ((select auth.uid()) = user_id);

-- Envoi des tampons d'un appareil : fusion côté serveur, pour qu'un appareil en retard n'efface rien de ce
-- qu'un autre a déjà envoyé (plus grand nombre de passages, première et dernière visite, tous les jeux).
create or replace function public.merge_passport(p_rows jsonb)
returns void
language sql security invoker set search_path = '' as $$
  insert into public.passport_stamps as ps (user_id, code, n, first_at, last_at, games)
  select (select auth.uid()), r.code, r.n, r.first_at, r.last_at, r.games
  from jsonb_to_recordset(p_rows) as r(code text, n integer, first_at timestamptz, last_at timestamptz, games text[])
  on conflict (user_id, code) do update set
    n = greatest(ps.n, excluded.n),
    first_at = least(ps.first_at, excluded.first_at),
    last_at = greatest(ps.last_at, excluded.last_at),
    games = (select array_agg(distinct g) from unnest(ps.games || excluded.games) as g)
$$;

revoke all on function public.merge_passport(jsonb) from public;
grant execute on function public.merge_passport(jsonb) to authenticated;
