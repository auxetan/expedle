-- Méridien : comptes, parties et classements.
-- À coller dans l'éditeur SQL du projet Supabase (SQL Editor → New query → Run). Peut être relancé sans risque.

-- Profil public : le pseudo et l'avatar affichés dans les classements. L'email reste privé (auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 24),
  avatar text not null default '🧭' check (char_length(avatar) <= 8),
  updated_at timestamptz not null default now()
);

-- Une ligne par partie terminée, telle que l'historique local la décrit.
create table if not exists public.plays (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  played_at timestamptz not null,
  -- jour local du joueur, celui du défi du jour
  day date not null,
  pts smallint not null check (pts between 0 and 100),
  score double precision,
  ms integer check (ms between 0 and 86400000),
  win boolean,
  -- entraînement, rejeu, archive, catégorie… ; vide pour la vraie partie du jour
  sub text check (char_length(sub) <= 80),
  primary key (user_id, game, played_at)
);

create index if not exists plays_game_day on public.plays (game, day);
create index if not exists plays_played_at on public.plays (played_at);

alter table public.profiles enable row level security;
alter table public.plays enable row level security;

drop policy if exists "Profils visibles par tous" on public.profiles;
create policy "Profils visibles par tous" on public.profiles for select using (true);
drop policy if exists "Créer son profil" on public.profiles;
create policy "Créer son profil" on public.profiles for insert with check ((select auth.uid()) = id);
drop policy if exists "Modifier son profil" on public.profiles;
create policy "Modifier son profil" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Chacun ne voit que ses propres parties ; les classements passent par les fonctions plus bas,
-- qui ne montrent que le pseudo, l'avatar et le score.
drop policy if exists "Lire ses parties" on public.plays;
create policy "Lire ses parties" on public.plays for select using ((select auth.uid()) = user_id);
drop policy if exists "Ajouter ses parties" on public.plays;
create policy "Ajouter ses parties" on public.plays for insert with check (
  (select auth.uid()) = user_id
  and played_at <= now() + interval '5 minutes'
  and day between (played_at at time zone 'utc')::date - 1 and (played_at at time zone 'utc')::date + 1
);
drop policy if exists "Effacer ses parties" on public.plays;
create policy "Effacer ses parties" on public.plays for delete using ((select auth.uid()) = user_id);

-- Classement d'un jeu du jour : seule compte la première vraie partie de chaque joueur ce jour-là.
-- Renvoie le haut du classement, plus la ligne du joueur connecté s'il est plus bas.
create or replace function public.daily_board(p_game text, p_day date, p_limit int default 50)
returns table (rank bigint, name text, avatar text, pts smallint, score double precision, ms integer, win boolean, me boolean)
language sql stable security definer set search_path = '' as $$
  with firsts as (
    select distinct on (pl.user_id) pl.user_id, pl.pts, pl.score, pl.ms, pl.win
    from public.plays pl
    where pl.game = p_game and pl.day = p_day and pl.sub is null
    order by pl.user_id, pl.played_at
  ), ranked as (
    select rank() over (order by f.pts desc, f.ms asc nulls last) as rank, f.*
    from firsts f
  )
  select r.rank, p.name, p.avatar, r.pts, r.score, r.ms, r.win, r.user_id = (select auth.uid())
  from ranked r join public.profiles p on p.id = r.user_id
  where r.rank <= least(p_limit, 100) or r.user_id = (select auth.uid())
  order by r.rank, p.name
$$;

-- Points cumulés depuis une date : la semaine, le mois ou depuis toujours.
create or replace function public.points_board(p_since timestamptz, p_limit int default 50)
returns table (rank bigint, name text, avatar text, points bigint, plays bigint, me boolean)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select pl.user_id, sum(pl.pts)::bigint as points, count(*) as plays
    from public.plays pl
    where pl.played_at >= p_since
    group by pl.user_id
  ), ranked as (
    select rank() over (order by t.points desc) as rank, t.*
    from totals t
  )
  select r.rank, p.name, p.avatar, r.points, r.plays, r.user_id = (select auth.uid())
  from ranked r join public.profiles p on p.id = r.user_id
  where r.rank <= least(p_limit, 100) or r.user_id = (select auth.uid())
  order by r.rank, p.name
$$;

revoke all on function public.daily_board(text, date, int) from public;
grant execute on function public.daily_board(text, date, int) to anon, authenticated;
revoke all on function public.points_board(timestamptz, int) from public;
grant execute on function public.points_board(timestamptz, int) to anon, authenticated;
