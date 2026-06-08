import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ESCROW_CONSTANTS } from '@shared/escrow';

export type BlinkMatchStatus =
  | 'PENDING'
  | 'EXPIRED'
  | 'CHALLENGED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FORFEITED';

export interface BlinkMatch {
  id: string;
  creatorWallet: string;
  opponentWallet: string | null;
  tokenMint: string;
  wagerAmount: string;
  status: BlinkMatchStatus;
  createdAt: string;
  expiresAt: string;
  joinDeadline: string | null;
  challengerDepositSignature: string | null;
  creatorDepositSignature: string | null;
}

export type AcceptBlinkMatchResult =
  | { ok: true; match: BlinkMatch }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_accepted' | 'creator_cannot_accept' | 'invalid_status' };

export interface CreateBlinkMatchInput {
  /** Pre-determined ID for PDA derivation. If omitted, a random UUID is generated. */
  id?: string;
  creatorWallet: string;
  tokenMint: string;
  wagerAmount: bigint;
}

export interface BlinkMatchStore {
  createPending(input: CreateBlinkMatchInput): Promise<BlinkMatch>;
  get(id: string): Promise<BlinkMatch | null>;
  acceptPending(id: string, opponentWallet: string, now?: Date): Promise<AcceptBlinkMatchResult>;
  markActive(id: string, creatorWallet: string, signature: string, now?: Date): Promise<BlinkMatch | null>;
  markCompleted(id: string): Promise<void>;
  expirePending(id: string, now?: Date): Promise<BlinkMatch | null>;
  forfeitChallenged(id: string, now?: Date): Promise<BlinkMatch | null>;
  sweepExpired(now?: Date): Promise<Array<{ id: string; status: Extract<BlinkMatchStatus, 'EXPIRED' | 'FORFEITED'> }>>;
}

const PENDING_TTL_MS = ESCROW_CONSTANTS.CHALLENGE_EXPIRY_SECONDS * 1000; // 900s
const JOIN_WINDOW_MS = ESCROW_CONSTANTS.DEPOSIT_TIMEOUT_SECONDS * 1000;  // 30s — matches on-chain timeout

type MatchRow = {
  id: string;
  creator_wallet: string;
  opponent_wallet: string | null;
  token_mint: string;
  wager_amount: string | number;
  status: BlinkMatchStatus;
  created_at: string;
  expires_at: string;
  join_deadline: string | null;
  challenger_deposit_signature?: string | null;
  creator_deposit_signature?: string | null;
};

export function createBlinkMatchStore(): BlinkMatchStore {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (!url || !key) {
    console.warn('[BlinkMatches] Supabase env missing; using in-memory Blink match store for local development.');
    return new MemoryBlinkMatchStore();
  }

  return new SupabaseBlinkMatchStore(url, key);
}

export function isBlinkMatchTerminal(status: BlinkMatchStatus): boolean {
  return status === 'EXPIRED' || status === 'FORFEITED' || status === 'COMPLETED';
}

export class MemoryBlinkMatchStore implements BlinkMatchStore {
  private matches = new Map<string, BlinkMatch>();

  public async createPending(input: CreateBlinkMatchInput): Promise<BlinkMatch> {
    const now = new Date();
    const match: BlinkMatch = {
      id: input.id ?? randomUUID(),
      creatorWallet: input.creatorWallet,
      opponentWallet: null,
      tokenMint: input.tokenMint,
      wagerAmount: input.wagerAmount.toString(),
      status: 'PENDING',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
      joinDeadline: null,
      challengerDepositSignature: null,
      creatorDepositSignature: null,
    };
    this.matches.set(match.id, match);
    return match;
  }

  public async get(id: string): Promise<BlinkMatch | null> {
    return this.matches.get(id) ?? null;
  }

  public async acceptPending(id: string, opponentWallet: string, now = new Date()): Promise<AcceptBlinkMatchResult> {
    const match = this.matches.get(id);
    if (!match) return { ok: false, reason: 'not_found' };
    if (match.creatorWallet === opponentWallet) return { ok: false, reason: 'creator_cannot_accept' };
    if (match.status === 'PENDING' && now.getTime() > Date.parse(match.expiresAt)) {
      const expired = { ...match, status: 'EXPIRED' as const };
      this.matches.set(id, expired);
      return { ok: false, reason: 'expired' };
    }
    if (match.status !== 'PENDING') {
      return { ok: false, reason: match.opponentWallet ? 'already_accepted' : 'invalid_status' };
    }
    if (match.opponentWallet) return { ok: false, reason: 'already_accepted' };

    const challenged: BlinkMatch = {
      ...match,
      opponentWallet,
      status: 'CHALLENGED',
      joinDeadline: new Date(now.getTime() + JOIN_WINDOW_MS).toISOString(),
    };
    this.matches.set(id, challenged);
    return { ok: true, match: challenged };
  }

  public async markActive(id: string, creatorWallet: string, signature: string, now = new Date()): Promise<BlinkMatch | null> {
    const match = this.matches.get(id);
    if (!match || match.status !== 'CHALLENGED') return null;
    if (match.creatorWallet !== creatorWallet) return null;
    if (match.joinDeadline && now.getTime() > Date.parse(match.joinDeadline)) {
      const forfeited = { ...match, status: 'FORFEITED' as const };
      this.matches.set(id, forfeited);
      return forfeited;
    }

    const active: BlinkMatch = {
      ...match,
      status: 'ACTIVE',
      creatorDepositSignature: signature,
    };
    this.matches.set(id, active);
    return active;
  }

  public async markCompleted(id: string): Promise<void> {
    const match = this.matches.get(id);
    if (!match || isBlinkMatchTerminal(match.status)) return;
    this.matches.set(id, { ...match, status: 'COMPLETED' });
  }

  public async expirePending(id: string, now = new Date()): Promise<BlinkMatch | null> {
    const match = this.matches.get(id);
    if (!match || match.status !== 'PENDING' || now.getTime() <= Date.parse(match.expiresAt)) return match ?? null;
    const expired = { ...match, status: 'EXPIRED' as const };
    this.matches.set(id, expired);
    return expired;
  }

  public async forfeitChallenged(id: string, now = new Date()): Promise<BlinkMatch | null> {
    const match = this.matches.get(id);
    if (!match || match.status !== 'CHALLENGED' || !match.joinDeadline) return match ?? null;
    if (now.getTime() <= Date.parse(match.joinDeadline)) return match;
    const forfeited = { ...match, status: 'FORFEITED' as const };
    this.matches.set(id, forfeited);
    return forfeited;
  }

  public async sweepExpired(now = new Date()): Promise<Array<{ id: string; status: 'EXPIRED' | 'FORFEITED' }>> {
    const updates: Array<{ id: string; status: 'EXPIRED' | 'FORFEITED' }> = [];
    for (const match of this.matches.values()) {
      if (match.status === 'PENDING' && now.getTime() > Date.parse(match.expiresAt)) {
        this.matches.set(match.id, { ...match, status: 'EXPIRED' });
        updates.push({ id: match.id, status: 'EXPIRED' });
      }
      if (match.status === 'CHALLENGED' && match.joinDeadline && now.getTime() > Date.parse(match.joinDeadline)) {
        this.matches.set(match.id, { ...match, status: 'FORFEITED' });
        updates.push({ id: match.id, status: 'FORFEITED' });
      }
    }
    return updates;
  }
}

class SupabaseBlinkMatchStore implements BlinkMatchStore {
  private clientPromise: Promise<SupabaseClient> | null = null;

  constructor(private url: string, private key: string) {}

  public async createPending(input: CreateBlinkMatchInput): Promise<BlinkMatch> {
    const now = new Date();
    const row = {
      id: input.id ?? randomUUID(),
      creator_wallet: input.creatorWallet,
      opponent_wallet: null,
      token_mint: input.tokenMint,
      wager_amount: input.wagerAmount.toString(),
      status: 'PENDING' satisfies BlinkMatchStatus,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
      join_deadline: null,
      challenger_deposit_signature: null,
      creator_deposit_signature: null,
    };

    const supabase = await this.getClient();
    const { data, error } = await supabase.from('matches').insert(row).select('*').single();
    if (error) throw error;
    return fromRow(data as MatchRow);
  }

  public async get(id: string): Promise<BlinkMatch | null> {
    const supabase = await this.getClient();
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as MatchRow) : null;
  }

  public async acceptPending(id: string, opponentWallet: string, now = new Date()): Promise<AcceptBlinkMatchResult> {
    const current = await this.get(id);
    if (!current) return { ok: false, reason: 'not_found' };
    if (current.creatorWallet === opponentWallet) return { ok: false, reason: 'creator_cannot_accept' };
    if (current.status === 'PENDING' && now.getTime() > Date.parse(current.expiresAt)) {
      await this.expirePending(id, now);
      return { ok: false, reason: 'expired' };
    }
    if (current.status !== 'PENDING') {
      return { ok: false, reason: current.opponentWallet ? 'already_accepted' : 'invalid_status' };
    }

    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from('matches')
      .update({
        opponent_wallet: opponentWallet,
        status: 'CHALLENGED' satisfies BlinkMatchStatus,
        join_deadline: new Date(now.getTime() + JOIN_WINDOW_MS).toISOString(),
      })
      .eq('id', id)
      .eq('status', 'PENDING')
      .is('opponent_wallet', null)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, reason: 'already_accepted' };
    return { ok: true, match: fromRow(data as MatchRow) };
  }

  public async markActive(id: string, creatorWallet: string, signature: string, now = new Date()): Promise<BlinkMatch | null> {
    const current = await this.get(id);
    if (!current || current.status !== 'CHALLENGED') return null;
    if (current.creatorWallet !== creatorWallet) return null;
    if (current.joinDeadline && now.getTime() > Date.parse(current.joinDeadline)) {
      return this.forfeitChallenged(id, now);
    }

    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from('matches')
      .update({
        status: 'ACTIVE' satisfies BlinkMatchStatus,
        creator_deposit_signature: signature,
      })
      .eq('id', id)
      .eq('status', 'CHALLENGED')
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data ? fromRow(data as MatchRow) : null;
  }

  public async markCompleted(id: string): Promise<void> {
    const supabase = await this.getClient();
    const { error } = await supabase
      .from('matches')
      .update({ status: 'COMPLETED' satisfies BlinkMatchStatus })
      .eq('id', id)
      .in('status', ['CHALLENGED', 'ACTIVE']);
    if (error) throw error;
  }

  public async expirePending(id: string, now = new Date()): Promise<BlinkMatch | null> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from('matches')
      .update({ status: 'EXPIRED' satisfies BlinkMatchStatus })
      .eq('id', id)
      .eq('status', 'PENDING')
      .lt('expires_at', now.toISOString())
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as MatchRow) : this.get(id);
  }

  public async forfeitChallenged(id: string, now = new Date()): Promise<BlinkMatch | null> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from('matches')
      .update({ status: 'FORFEITED' satisfies BlinkMatchStatus })
      .eq('id', id)
      .eq('status', 'CHALLENGED')
      .lt('join_deadline', now.toISOString())
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as MatchRow) : this.get(id);
  }

  public async sweepExpired(now = new Date()): Promise<Array<{ id: string; status: 'EXPIRED' | 'FORFEITED' }>> {
    const nowIso = now.toISOString();
    const updates: Array<{ id: string; status: 'EXPIRED' | 'FORFEITED' }> = [];

    const supabase = await this.getClient();
    const { data: expired, error: expiredError } = await supabase
      .from('matches')
      .update({ status: 'EXPIRED' satisfies BlinkMatchStatus })
      .eq('status', 'PENDING')
      .lt('expires_at', nowIso)
      .select('id');
    if (expiredError) throw expiredError;
    for (const row of expired ?? []) updates.push({ id: row.id as string, status: 'EXPIRED' });

    const { data: forfeited, error: forfeitedError } = await supabase
      .from('matches')
      .update({ status: 'FORFEITED' satisfies BlinkMatchStatus })
      .eq('status', 'CHALLENGED')
      .lt('join_deadline', nowIso)
      .select('id');
    if (forfeitedError) throw forfeitedError;
    for (const row of forfeited ?? []) updates.push({ id: row.id as string, status: 'FORFEITED' });

    return updates;
  }

  private getClient(): Promise<SupabaseClient> {
    this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(this.url, this.key));
    return this.clientPromise;
  }
}

function fromRow(row: MatchRow): BlinkMatch {
  return {
    id: row.id,
    creatorWallet: row.creator_wallet,
    opponentWallet: row.opponent_wallet,
    tokenMint: row.token_mint,
    wagerAmount: row.wager_amount.toString(),
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    joinDeadline: row.join_deadline,
    challengerDepositSignature: row.challenger_deposit_signature ?? null,
    creatorDepositSignature: row.creator_deposit_signature ?? null,
  };
}
