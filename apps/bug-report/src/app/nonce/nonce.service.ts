import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface NonceIssueResult {
  nonce: string;
  expiresAt: string;
}

/**
 * Single-use, TTL-bound, IP-bound nonce store.
 * In-memory Map with Redis-ready interface (issue/consume).
 */
@Injectable()
export class NonceService {
  private readonly store = new Map<string, { ip: string; exp: number }>();

  constructor(@Optional() ttlMs?: number) {
    this.ttlMs = ttlMs ?? 5 * 60 * 1000;
  }

  private readonly ttlMs: number;

  async issue(ip: string): Promise<NonceIssueResult> {
    const nonce = randomBytes(32).toString('hex'); // 64 hex chars
    const expiresAtMs = Date.now() + this.ttlMs;
    this.store.set(nonce, { ip, exp: expiresAtMs });
    return { nonce, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  async consume(nonce: string, ip: string): Promise<true> {
    const rec = this.store.get(nonce);
    if (!rec) {
      throw new BadRequestException('invalid nonce');
    }
    // Single-use: delete even on failure paths below.
    this.store.delete(nonce);
    if (Date.now() > rec.exp) {
      throw new BadRequestException('nonce expired');
    }
    if (rec.ip !== ip) {
      throw new BadRequestException('nonce ip mismatch');
    }
    return true;
  }

  /** Test/ops helper: purge expired entries. */
  purgeExpired(now = Date.now()): number {
    let removed = 0;
    for (const [k, v] of this.store) {
      if (now > v.exp) {
        this.store.delete(k);
        removed++;
      }
    }
    return removed;
  }
}
