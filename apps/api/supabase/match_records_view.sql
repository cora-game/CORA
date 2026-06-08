create or replace view public.match_records as
select
  qm.id::text as id,
  'queue'::text as match_source,

  qm.player_a,
  qm.player_b,

  qm.token_mint,
  qm.wager_amount,

  qm.status,
  qm.winner,

  qm.created_at,
  qm.activated_at,
  qm.settled_at,

  qm.cancel_reason,
  qm.settlement_error
from public.queue_matches qm

union all

select
  bm.id::text as id,
  'blink'::text as match_source,

  bm.creator_wallet as player_a,
  bm.opponent_wallet as player_b,

  bm.token_mint,
  bm.wager_amount,

  bm.status,
  null::text as winner,

  bm.created_at,
  null::timestamptz as activated_at,
  null::timestamptz as settled_at,

  null::text as cancel_reason,
  null::text as settlement_error
from public.matches bm;
