-- Expedle : le portefeuille de pépites suit le compte d'un appareil à l'autre.
-- Se colle telle quelle dans l'éditeur SQL du projet, après les migrations précédentes. Peut être relancée sans risque.
-- Les pépites gagnées se recalculent depuis l'historique des parties (table plays) ; seuls les achats et les
-- jokers utilisés ont besoin d'être gardés ici, chacun daté pour qu'aucun ne compte deux fois.

create table if not exists public.wallets (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  purchases jsonb not null default '[]' check (jsonb_typeof(purchases) = 'array' and jsonb_array_length(purchases) <= 5000),
  uses jsonb not null default '[]' check (jsonb_typeof(uses) = 'array' and jsonb_array_length(uses) <= 20000),
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

drop policy if exists "Lire son portefeuille" on public.wallets;
create policy "Lire son portefeuille" on public.wallets for select using ((select auth.uid()) = user_id);
drop policy if exists "Créer son portefeuille" on public.wallets;
create policy "Créer son portefeuille" on public.wallets for insert with check ((select auth.uid()) = user_id);
drop policy if exists "Mettre à jour son portefeuille" on public.wallets;
create policy "Mettre à jour son portefeuille" on public.wallets for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
