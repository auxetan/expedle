-- Méridien : défis entre amis, liste d'amis et classements entre amis.
-- Se colle telle quelle dans l'éditeur SQL du projet, après 20261017000000_meridien.sql. Peut être relancée sans risque.

-- Code ami : 8 caractères tirés de l'identifiant, à donner à ses amis pour qu'ils nous ajoutent.
alter table public.profiles add column if not exists code text generated always as (upper(substr(md5(id::text), 1, 8))) stored;
create unique index if not exists profiles_code on public.profiles (code);

-- Un défi = un jeu et une graine : tous ceux qui ouvrent le lien jouent exactement le même tirage.
-- Seul le premier essai de chacun compte.
create table if not exists public.challenge_scores (
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  seed text not null check (seed ~ '^[A-Za-z0-9._~:,-]{1,400}$'),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  pts smallint not null check (pts between 0 and 100),
  score double precision,
  ms integer check (ms between 0 and 86400000),
  win boolean,
  played_at timestamptz not null default now(),
  primary key (game, seed, user_id)
);

-- Suivre quelqu'un : ses scores apparaissent dans « Entre amis » et on peut lui envoyer des défis.
create table if not exists public.friends (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- Défi envoyé à un ami : il le retrouve dans sa page Défis.
create table if not exists public.challenge_invites (
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  seed text not null check (seed ~ '^[A-Za-z0-9._~:,-]{1,400}$'),
  from_id uuid not null default auth.uid() references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game, seed, from_id, to_id)
);

create index if not exists challenge_invites_to on public.challenge_invites (to_id, created_at desc);
create index if not exists friends_friend on public.friends (friend_id);

alter table public.challenge_scores enable row level security;
alter table public.friends enable row level security;
alter table public.challenge_invites enable row level security;

-- Chacun écrit et lit ses propres lignes ; les scores des autres passent par les fonctions plus bas.
drop policy if exists "Lire ses défis" on public.challenge_scores;
create policy "Lire ses défis" on public.challenge_scores for select using ((select auth.uid()) = user_id);
drop policy if exists "Ajouter ses défis" on public.challenge_scores;
create policy "Ajouter ses défis" on public.challenge_scores for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Lire ses amis" on public.friends;
create policy "Lire ses amis" on public.friends for select using ((select auth.uid()) = user_id);
drop policy if exists "Retirer un ami" on public.friends;
create policy "Retirer un ami" on public.friends for delete using ((select auth.uid()) = user_id);

-- les invitations s'envoient par send_challenge, qui vérifie que le destinataire est bien un ami
drop policy if exists "Voir ses invitations" on public.challenge_invites;
create policy "Voir ses invitations" on public.challenge_invites for select using ((select auth.uid()) in (from_id, to_id));

-- Ajouter un ami par son code.
create or replace function public.add_friend(p_code text)
returns table (name text, avatar text, code text)
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  select p.id into target from public.profiles p where p.code = upper(btrim(p_code));
  if target is null then raise exception 'unknown_code'; end if;
  if target = (select auth.uid()) then raise exception 'own_code'; end if;
  insert into public.friends (user_id, friend_id) values ((select auth.uid()), target) on conflict do nothing;
  return query select p.name, p.avatar, p.code from public.profiles p where p.id = target;
end
$$;

create or replace function public.remove_friend(p_code text)
returns void
language sql security definer set search_path = '' as $$
  delete from public.friends f
  using public.profiles p
  where f.user_id = (select auth.uid()) and f.friend_id = p.id and p.code = upper(btrim(p_code))
$$;

-- Envoyer un défi à des amis (ceux qu'on suit), désignés par leur code. Renvoie le nombre d'invitations parties.
create or replace function public.send_challenge(p_game text, p_seed text, p_codes text[])
returns integer
language sql security definer set search_path = '' as $$
  with sent as (
    insert into public.challenge_invites (game, seed, from_id, to_id)
    select p_game, p_seed, (select auth.uid()), f.friend_id
    from public.friends f join public.profiles p on p.id = f.friend_id
    where f.user_id = (select auth.uid()) and p.code in (select upper(btrim(c)) from unnest(p_codes) c)
    on conflict do nothing
    returning 1
  )
  select count(*)::int from sent
$$;

-- Ses amis, avec leurs points de la semaine ; « mutual » quand ils nous suivent aussi.
create or replace function public.my_friends()
returns table (name text, avatar text, code text, mutual boolean, week_points bigint)
language sql stable security definer set search_path = '' as $$
  select p.name, p.avatar, p.code,
    exists (select 1 from public.friends g where g.user_id = f.friend_id and g.friend_id = f.user_id),
    coalesce((select sum(pl.pts)::bigint from public.plays pl where pl.user_id = f.friend_id and pl.played_at >= date_trunc('week', now())), 0)
  from public.friends f join public.profiles p on p.id = f.friend_id
  where f.user_id = (select auth.uid())
  order by p.name
$$;

-- Les joueurs d'un défi, du meilleur au moins bon.
create or replace function public.challenge_board(p_game text, p_seed text)
returns table (rank bigint, name text, avatar text, code text, pts smallint, score double precision, ms integer, win boolean, me boolean, friend boolean)
language sql stable security definer set search_path = '' as $$
  select rank() over (order by c.pts desc, c.ms asc nulls last), p.name, p.avatar, p.code, c.pts, c.score, c.ms, c.win,
    c.user_id = (select auth.uid()),
    exists (select 1 from public.friends f where f.user_id = (select auth.uid()) and f.friend_id = c.user_id)
  from public.challenge_scores c join public.profiles p on p.id = c.user_id
  where c.game = p_game and c.seed = p_seed
  order by 1, p.name
  limit 100
$$;

-- Les défis du joueur : ceux qu'il a joués et ceux qu'on lui a envoyés, les plus récents d'abord.
create or replace function public.my_challenges()
returns table (game text, seed text, at timestamptz, from_name text, from_avatar text, played boolean, players bigint, my_rank bigint, leader_name text, leader_pts smallint)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select c.game, c.seed, c.played_at as at, null::uuid as from_id
    from public.challenge_scores c where c.user_id = (select auth.uid())
    union all
    select i.game, i.seed, i.created_at, i.from_id
    from public.challenge_invites i where i.to_id = (select auth.uid())
  ), grouped as (
    select m.game, m.seed, max(m.at) as at, (array_agg(m.from_id) filter (where m.from_id is not null))[1] as from_id
    from mine m group by m.game, m.seed
  ), ranked as (
    select c.game, c.seed, c.user_id, c.pts, rank() over (partition by c.game, c.seed order by c.pts desc, c.ms asc nulls last) as rk
    from public.challenge_scores c join grouped g on g.game = c.game and g.seed = c.seed
  )
  select g.game, g.seed, g.at, fp.name, fp.avatar,
    exists (select 1 from ranked r where r.game = g.game and r.seed = g.seed and r.user_id = (select auth.uid())),
    (select count(*) from ranked r where r.game = g.game and r.seed = g.seed),
    (select r.rk from ranked r where r.game = g.game and r.seed = g.seed and r.user_id = (select auth.uid())),
    (select lp.name from ranked r join public.profiles lp on lp.id = r.user_id where r.game = g.game and r.seed = g.seed order by r.rk, lp.name limit 1),
    (select r.pts from ranked r where r.game = g.game and r.seed = g.seed order by r.rk limit 1)
  from grouped g left join public.profiles fp on fp.id = g.from_id
  order by g.at desc
  limit 60
$$;

-- Les classements acceptent maintenant un filtre « entre amis » : le joueur et les personnes qu'il suit.
drop function if exists public.daily_board(text, date, int);
create or replace function public.daily_board(p_game text, p_day date, p_limit int default 50, p_friends boolean default false)
returns table (rank bigint, name text, avatar text, pts smallint, score double precision, ms integer, win boolean, me boolean)
language sql stable security definer set search_path = '' as $$
  with firsts as (
    select distinct on (pl.user_id) pl.user_id, pl.pts, pl.score, pl.ms, pl.win
    from public.plays pl
    where pl.game = p_game and pl.day = p_day and pl.sub is null
      and (not p_friends or pl.user_id = (select auth.uid())
        or pl.user_id in (select f.friend_id from public.friends f where f.user_id = (select auth.uid())))
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

drop function if exists public.points_board(timestamptz, int);
create or replace function public.points_board(p_since timestamptz, p_limit int default 50, p_friends boolean default false)
returns table (rank bigint, name text, avatar text, points bigint, plays bigint, me boolean)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select pl.user_id, sum(pl.pts)::bigint as points, count(*) as plays
    from public.plays pl
    where pl.played_at >= p_since
      and (not p_friends or pl.user_id = (select auth.uid())
        or pl.user_id in (select f.friend_id from public.friends f where f.user_id = (select auth.uid())))
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

revoke all on function public.add_friend(text) from public;
grant execute on function public.add_friend(text) to authenticated;
revoke all on function public.remove_friend(text) from public;
grant execute on function public.remove_friend(text) to authenticated;
revoke all on function public.send_challenge(text, text, text[]) from public;
grant execute on function public.send_challenge(text, text, text[]) to authenticated;
revoke all on function public.my_friends() from public;
grant execute on function public.my_friends() to authenticated;
revoke all on function public.my_challenges() from public;
grant execute on function public.my_challenges() to authenticated;
revoke all on function public.challenge_board(text, text) from public;
grant execute on function public.challenge_board(text, text) to anon, authenticated;
revoke all on function public.daily_board(text, date, int, boolean) from public;
grant execute on function public.daily_board(text, date, int, boolean) to anon, authenticated;
revoke all on function public.points_board(timestamptz, int, boolean) from public;
grant execute on function public.points_board(timestamptz, int, boolean) to anon, authenticated;
