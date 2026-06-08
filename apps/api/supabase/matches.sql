create table if not exists public.matches (
  id uuid primary key,
  creator_wallet text not null,
  opponent_wallet text,
  token_mint text not null,
  escrow_pda text,
  wager_amount numeric not null,
  status text not null check (
    status in ('PENDING', 'EXPIRED', 'CHALLENGED', 'ACTIVE', 'COMPLETED', 'FORFEITED')
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  join_deadline timestamptz,
  challenger_deposit_signature text,
  creator_deposit_signature text
);

create index if not exists matches_status_expires_at_idx
  on public.matches (status, expires_at);

create index if not exists matches_status_join_deadline_idx
  on public.matches (status, join_deadline);

create index if not exists matches_creator_wallet_idx
  on public.matches (creator_wallet);

create index if not exists matches_opponent_wallet_idx
  on public.matches (opponent_wallet);
