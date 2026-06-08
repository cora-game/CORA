create table if not exists public.queue_matches (
  id text primary key,

  player_a text not null,
  player_b text not null,

  token_mint text,
  wager_amount numeric not null default 0,

  status text not null check (
    status in (
      'DEPOSITING',
      'ACTIVE',
      'COMPLETED',
      'FORFEITED',
      'CANCELLED',
      'ABANDONED',
      'SETTLEMENT_FAILED'
    )
  ),

  winner text,

  created_at timestamptz not null default now(),
  activated_at timestamptz,
  settled_at timestamptz,

  player_a_deposit_signature text,
  player_b_deposit_signature text,

  cancel_reason text,
  settlement_error text
);

create index if not exists queue_matches_player_a_idx
  on public.queue_matches(player_a);

create index if not exists queue_matches_player_b_idx
  on public.queue_matches(player_b);

create index if not exists queue_matches_status_idx
  on public.queue_matches(status);

create index if not exists queue_matches_created_at_idx
  on public.queue_matches(created_at desc);

create index if not exists queue_matches_winner_idx
  on public.queue_matches(winner);
