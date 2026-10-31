-- Expedle : le mode classe. Un professeur crée une classe et donne son code ; ses élèves la rejoignent avec ce code
-- et un pseudo, sans email ni nom (comptes anonymes de Supabase : ils peuvent être mineurs).
-- Se colle telle quelle dans l'éditeur SQL du projet, après les migrations précédentes. Peut être relancée sans risque.
-- À activer en plus : Authentication → Sign In / Providers → « Allow anonymous sign-ins ».

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  -- 6 caractères sans I, L, O, 0 ni 1, qu'on ne confond pas en les recopiant au tableau
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  teacher_id uuid not null default auth.uid() references auth.users on delete cascade,
  -- les jeux à faire, épinglés par le professeur : des adresses du site (#/quiz/francophonie…)
  games text[] not null default '{}' check (
    cardinality(games) <= 8 and array_position(games, null) is null
    and array_to_string(games, ',') ~ '^(#/[a-z0-9/-]{1,60}(,#/[a-z0-9/-]{1,60})*)?$'
  ),
  -- fermée, la classe n'accepte plus de nouveaux élèves (un code qui circule hors de la classe ne sert plus)
  open boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un élève dans une classe : son pseudo est tout ce que voient le professeur et les autres élèves.
create table if not exists public.class_members (
  class_id uuid not null references public.classes on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pseudo text not null check (char_length(btrim(pseudo)) between 2 and 20 and position('@' in pseudo) = 0),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create unique index if not exists class_members_pseudo on public.class_members (class_id, lower(btrim(pseudo)));
create index if not exists class_members_user on public.class_members (user_id);
create index if not exists classes_teacher on public.classes (teacher_id);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;

-- Le professeur lit, renomme, ferme et supprime ses classes ; on les crée par create_class, on les rejoint par join_class.
drop policy if exists "Voir ses classes" on public.classes;
create policy "Voir ses classes" on public.classes for select using ((select auth.uid()) = teacher_id);
drop policy if exists "Modifier ses classes" on public.classes;
create policy "Modifier ses classes" on public.classes for update using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);
drop policy if exists "Supprimer ses classes" on public.classes;
create policy "Supprimer ses classes" on public.classes for delete using ((select auth.uid()) = teacher_id);

-- seuls le nom, les jeux à faire et l'ouverture changent ; le code et le professeur restent
revoke update on public.classes from anon, authenticated;
grant update (name, games, open) on public.classes to authenticated;

-- Un élève voit et quitte sa place ; le professeur voit et retire les élèves de ses classes.
drop policy if exists "Voir les places" on public.class_members;
create policy "Voir les places" on public.class_members for select using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = (select auth.uid()))
);
drop policy if exists "Quitter ou retirer" on public.class_members;
create policy "Quitter ou retirer" on public.class_members for delete using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = (select auth.uid()))
);

-- Créer une classe : réservé aux comptes avec email, les comptes anonymes étant ceux des élèves.
create or replace function public.create_class(p_name text)
returns public.classes
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  candidate text;
  created public.classes;
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  if coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then raise exception 'anonymous'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 40 then raise exception 'bad_name'; end if;
  loop
    -- les 6 premiers octets d'un UUID v4 sont tirés au hasard
    bytes := uuid_send(gen_random_uuid());
    candidate := '';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, get_byte(bytes, i) % 31 + 1, 1);
    end loop;
    begin
      insert into public.classes (code, name, teacher_id) values (candidate, btrim(p_name), (select auth.uid())) returning * into created;
      return created;
    exception when unique_violation then
      -- code déjà pris : on en tire un autre
      null;
    end;
  end loop;
end
$$;

-- Rejoindre une classe par son code, avec un pseudo ; le relancer change le pseudo.
create or replace function public.join_class(p_code text, p_pseudo text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = '' as $$
declare
  target public.classes;
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  if char_length(v_pseudo) not between 2 and 20 or position('@' in v_pseudo) > 0 then raise exception 'bad_pseudo'; end if;
  select c.* into target from public.classes c where c.code = upper(btrim(p_code));
  if target.id is null then raise exception 'unknown_code'; end if;
  if target.teacher_id = (select auth.uid()) then raise exception 'own_class'; end if;
  if not target.open and not exists (select 1 from public.class_members m where m.class_id = target.id and m.user_id = (select auth.uid())) then
    raise exception 'closed';
  end if;
  begin
    insert into public.class_members as m (class_id, user_id, pseudo) values (target.id, (select auth.uid()), v_pseudo)
    on conflict (class_id, user_id) do update set pseudo = excluded.pseudo;
  exception when unique_violation then
    raise exception 'pseudo_taken';
  end;
  return query select target.id, target.name;
end
$$;

-- Les classes du joueur : celles qu'il anime (teacher) et celles qu'il a rejointes (avec son pseudo).
create or replace function public.my_classes()
returns table (id uuid, code text, name text, games text[], open boolean, teacher boolean, pseudo text, members bigint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.code, c.name, c.games, c.open, c.teacher_id = (select auth.uid()), m.pseudo,
    (select count(*) from public.class_members x where x.class_id = c.id), c.created_at
  from public.classes c
  left join public.class_members m on m.class_id = c.id and m.user_id = (select auth.uid())
  where c.teacher_id = (select auth.uid()) or m.user_id is not null
  order by c.created_at desc
$$;

-- Le classement d'une classe : les points de chaque élève depuis une date (le lundi pour la semaine), ceux qui
-- n'ont pas encore joué compris. Visible du professeur et des élèves de la classe seulement.
create or replace function public.class_board(p_class uuid, p_since timestamptz)
returns table (rank bigint, pseudo text, points bigint, plays bigint, me boolean)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select m.user_id, m.pseudo, coalesce(sum(pl.pts), 0)::bigint as points, count(pl.played_at) as plays
    from public.class_members m
    left join public.plays pl on pl.user_id = m.user_id and pl.played_at >= p_since
    where m.class_id = p_class
      and (exists (select 1 from public.classes c where c.id = p_class and c.teacher_id = (select auth.uid()))
        or exists (select 1 from public.class_members x where x.class_id = p_class and x.user_id = (select auth.uid())))
    group by m.user_id, m.pseudo
  )
  select rank() over (order by t.points desc), t.pseudo, t.points, t.plays, t.user_id = (select auth.uid())
  from totals t
  order by 1, t.pseudo
$$;

-- les comptes anonymes des élèves sont « authenticated » : « anon » (aucune session) n'a rien à appeler ici
revoke all on function public.create_class(text) from public, anon;
grant execute on function public.create_class(text) to authenticated;
revoke all on function public.join_class(text, text) from public, anon;
grant execute on function public.join_class(text, text) to authenticated;
revoke all on function public.my_classes() from public, anon;
grant execute on function public.my_classes() to authenticated;
revoke all on function public.class_board(uuid, timestamptz) from public, anon;
grant execute on function public.class_board(uuid, timestamptz) to authenticated;
