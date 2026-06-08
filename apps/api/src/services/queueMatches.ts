import type { SupabaseClient } from '@supabase/supabase-js';

export type QueueMatchStatus =
  | 'DEPOSITING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FORFEITED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'SETTLEMENT_FAILED';

export interface QueueMatch {
  id: string;
  playerA: string;
  playerB: string;
  tokenMint: string | null;
  wagerAmount: string;
  status: QueueMatchStatus;
  winner: string | null;
  createdAt: string;
  activatedAt: string | null;
  settledAt: string | null;
  playerADepositSignature: string | null;
  playerBDepositSignature: string | null;
  cancelReason: string | null;
  settlementError: string | null;
}

export interface QueueMatchStore {
  create(input: {
    id: string;
    playerA: string;
    playerB: string;
    tokenMint?: string | null;
    wagerAmount?: bigint | null;
  }): Promise<QueueMatch>;
  get(id: string): Promise<QueueMatch | null>;
  updateTokenInfo(id: string, tokenMint: string, wagerAmount: bigint): Promise<void>;
  markActive(id: string, playerASignature: string, playerBSignature: string): Promise<void>;
  markCompleted(id: string, winner: string): Promise<void>;
  markForfeited(id: string, winner: string, reason: string): Promise<void>;
  markCancelled(id: string, reason: string): Promise<void>;
  markAbandoned(id: string, reason: string): Promise<void>;
  markSettlementFailed(id: string, winner: string | null, error: unknown): Promise<void>;
}

type QueueMatchRow = {
  id: string;
  player_a: string;
  player_b: string;
  token_mint: string | null;
  wager_amount: string | number;
  status: QueueMatchStatus;
  winner: string | null;
  created_at: string;
  activated_at: string | null;
  settled_at: string | null;
  player_a_deposit_signature: string | null;
  player_b_deposit_signature: string | null;
  cancel_reason: string | null;
  settlement_error: string | null;
};

export function createQueueMatchStore(): QueueMatchStore {
  if (isTestRuntime()) {
    return new MemoryQueueMatchStore();
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (!url || !key) {
    console.warn('[QueueMatches] Supabase env missing; using in-memory queue match store.');
    return new MemoryQueueMatchStore();
  }

  return new SupabaseQueueMatchStore(url, key);
}

function isTestRuntime(): boolean {
  const globals = globalThis as { test?: unknown; expect?: unknown };
  return typeof globals.test === 'function' && typeof globals.expect === 'function';
}

export class MemoryQueueMatchStore implements QueueMatchStore {
  private matches = new Map<string, QueueMatch>();

  public async create(input: {
    id: string;
    playerA: string;
    playerB: string;
    tokenMint?: string | null;
    wagerAmount?: bigint | null;
  }): Promise<QueueMatch> {
    const match: QueueMatch = {
      id: input.id,
      playerA: input.playerA,
      playerB: input.playerB,
      tokenMint: input.tokenMint ?? null,
      wagerAmount: (input.wagerAmount ?? 0n).toString(),
      status: 'DEPOSITING',
      winner: null,
      createdAt: new Date().toISOString(),
      activatedAt: null,
      settledAt: null,
      playerADepositSignature: null,
      playerBDepositSignature: null,
      cancelReason: null,
      settlementError: null,
    };
    this.matches.set(match.id, match);
    return match;
  }

  public async get(id: string): Promise<QueueMatch | null> {
    return this.matches.get(id) ?? null;
  }

  public async updateTokenInfo(id: string, tokenMint: string, wagerAmount: bigint): Promise<void> {
    this.update(id, ['DEPOSITING', 'ACTIVE'], (match) => ({
      ...match,
      tokenMint,
      wagerAmount: wagerAmount.toString(),
    }), 'updateTokenInfo');
  }

  public async markActive(id: string, playerASignature: string, playerBSignature: string): Promise<void> {
    this.update(id, ['DEPOSITING'], (match) => ({
      ...match,
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      playerADepositSignature: playerASignature,
      playerBDepositSignature: playerBSignature,
    }), 'markActive');
  }

  public async markCompleted(id: string, winner: string): Promise<void> {
    this.update(id, ['ACTIVE'], (match) => ({
      ...match,
      status: 'COMPLETED',
      winner,
      settledAt: new Date().toISOString(),
    }), 'markCompleted');
  }

  public async markForfeited(id: string, winner: string, reason: string): Promise<void> {
    this.update(id, ['DEPOSITING'], (match) => ({
      ...match,
      status: 'FORFEITED',
      winner,
      cancelReason: reason,
      settledAt: new Date().toISOString(),
    }), 'markForfeited');
  }

  public async markCancelled(id: string, reason: string): Promise<void> {
    this.update(id, ['DEPOSITING'], (match) => ({
      ...match,
      status: 'CANCELLED',
      cancelReason: reason,
      settledAt: new Date().toISOString(),
    }), 'markCancelled');
  }

  public async markAbandoned(id: string, reason: string): Promise<void> {
    this.update(id, ['DEPOSITING'], (match) => ({
      ...match,
      status: 'ABANDONED',
      cancelReason: reason,
      settledAt: new Date().toISOString(),
    }), 'markAbandoned');
  }

  public async markSettlementFailed(id: string, winner: string | null, error: unknown): Promise<void> {
    this.update(id, ['ACTIVE'], (match) => ({
      ...match,
      status: 'SETTLEMENT_FAILED',
      winner,
      settledAt: new Date().toISOString(),
      settlementError: serializeError(error),
    }), 'markSettlementFailed');
  }

  private update(
    id: string,
    allowedStatuses: QueueMatchStatus[],
    updater: (match: QueueMatch) => QueueMatch,
    operation: string,
  ): void {
    const current = this.matches.get(id);
    if (!current || !allowedStatuses.includes(current.status)) {
      console.warn(`[QueueMatches] ${operation} skipped; row missing or invalid status: ${id}`);
      return;
    }
    this.matches.set(id, updater(current));
  }
}

class SupabaseQueueMatchStore implements QueueMatchStore {
  private clientPromise: Promise<SupabaseClient> | null = null;

  constructor(private url: string, private key: string) {}

  public async create(input: {
    id: string;
    playerA: string;
    playerB: string;
    tokenMint?: string | null;
    wagerAmount?: bigint | null;
  }): Promise<QueueMatch> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from('queue_matches')
      .insert({
        id: input.id,
        player_a: input.playerA,
        player_b: input.playerB,
        token_mint: input.tokenMint ?? null,
        wager_amount: (input.wagerAmount ?? 0n).toString(),
        status: 'DEPOSITING' satisfies QueueMatchStatus,
      })
      .select('*')
      .single();
    if (error) throw error;
    return fromRow(data as QueueMatchRow);
  }

  public async get(id: string): Promise<QueueMatch | null> {
    const supabase = await this.getClient();
    const { data, error } = await supabase.from('queue_matches').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as QueueMatchRow) : null;
  }

  public async updateTokenInfo(id: string, tokenMint: string, wagerAmount: bigint): Promise<void> {
    await this.updateRows(
      id,
      'updateTokenInfo',
      { token_mint: tokenMint, wager_amount: wagerAmount.toString() },
      ['DEPOSITING', 'ACTIVE'],
    );
  }

  public async markActive(id: string, playerASignature: string, playerBSignature: string): Promise<void> {
    await this.updateRows(
      id,
      'markActive',
      {
        status: 'ACTIVE' satisfies QueueMatchStatus,
        activated_at: new Date().toISOString(),
        player_a_deposit_signature: playerASignature,
        player_b_deposit_signature: playerBSignature,
      },
      ['DEPOSITING'],
    );
  }

  public async markCompleted(id: string, winner: string): Promise<void> {
    await this.updateRows(
      id,
      'markCompleted',
      {
        status: 'COMPLETED' satisfies QueueMatchStatus,
        winner,
        settled_at: new Date().toISOString(),
      },
      ['ACTIVE'],
    );
  }

  public async markForfeited(id: string, winner: string, reason: string): Promise<void> {
    await this.updateRows(
      id,
      'markForfeited',
      {
        status: 'FORFEITED' satisfies QueueMatchStatus,
        winner,
        cancel_reason: reason,
        settled_at: new Date().toISOString(),
      },
      ['DEPOSITING'],
    );
  }

  public async markCancelled(id: string, reason: string): Promise<void> {
    await this.updateRows(
      id,
      'markCancelled',
      {
        status: 'CANCELLED' satisfies QueueMatchStatus,
        cancel_reason: reason,
        settled_at: new Date().toISOString(),
      },
      ['DEPOSITING'],
    );
  }

  public async markAbandoned(id: string, reason: string): Promise<void> {
    await this.updateRows(
      id,
      'markAbandoned',
      {
        status: 'ABANDONED' satisfies QueueMatchStatus,
        cancel_reason: reason,
        settled_at: new Date().toISOString(),
      },
      ['DEPOSITING'],
    );
  }

  public async markSettlementFailed(id: string, winner: string | null, error: unknown): Promise<void> {
    await this.updateRows(
      id,
      'markSettlementFailed',
      {
        status: 'SETTLEMENT_FAILED' satisfies QueueMatchStatus,
        winner,
        settlement_error: serializeError(error),
        settled_at: new Date().toISOString(),
      },
      ['ACTIVE'],
    );
  }

  private async updateRows(
    id: string,
    operation: string,
    values: Record<string, unknown>,
    allowedStatuses: QueueMatchStatus[],
  ): Promise<void> {
    const supabase = await this.getClient();
    const query = supabase.from('queue_matches').update(values).eq('id', id);
    const { data, error } = allowedStatuses.length === 1
      ? await query.eq('status', allowedStatuses[0]).select('id')
      : await query.in('status', allowedStatuses).select('id');
    if (error) throw error;
    if (!data?.length) {
      console.warn(`[QueueMatches] ${operation} skipped; row missing or invalid status: ${id}`);
    }
  }

  private getClient(): Promise<SupabaseClient> {
    this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(this.url, this.key));
    return this.clientPromise;
  }
}

function fromRow(row: QueueMatchRow): QueueMatch {
  return {
    id: row.id,
    playerA: row.player_a,
    playerB: row.player_b,
    tokenMint: row.token_mint,
    wagerAmount: row.wager_amount.toString(),
    status: row.status,
    winner: row.winner,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    settledAt: row.settled_at,
    playerADepositSignature: row.player_a_deposit_signature,
    playerBDepositSignature: row.player_b_deposit_signature,
    cancelReason: row.cancel_reason,
    settlementError: row.settlement_error,
  };
}

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
