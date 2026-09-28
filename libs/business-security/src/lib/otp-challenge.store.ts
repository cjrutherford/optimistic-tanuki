import { Injectable } from '@nestjs/common';
import {
  IsNull,
  MoreThan,
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';
import { withTenantRlsTransaction } from './rls-session-binding';
import { OtpChallengeEntity } from './otp-challenge.entity';

export const OTP_CHALLENGE_STORE = 'OTP_CHALLENGE_STORE';
export const OTP_TOTP_REPLAY_PURPOSE = 'rolling-totp-replay';
export const OTP_TOTP_FAILURE_PURPOSE = 'rolling-totp-failure';

export interface StoredOtpChallenge {
  tokenId: string;
  tenantId: string;
  purpose: string;
  codeHash: string;
  codeSalt: string;
  expiresAt: Date;
  attemptCount: number;
  consumedAt: Date | null;
}

export interface OtpTotpReplayState {
  tokenId: string;
  tenantId: string;
  purpose: string;
  lastAcceptedCounter: number;
  expiresAt: Date;
  windowSeconds: number;
}

export interface OtpTotpFailureState {
  tokenId: string;
  tenantId: string;
  purpose: string;
  attempts: number;
  expiresAt: Date;
}

export interface OtpChallengeStore {
  readonly requiresTenantContext?: boolean;
  storeChallenge(challenge: StoredOtpChallenge): Promise<void>;
  getChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now?: Date
  ): Promise<StoredOtpChallenge | null>;
  recordFailedAttempt(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now?: Date
  ): Promise<StoredOtpChallenge | null>;
  consumeChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now?: Date
  ): Promise<StoredOtpChallenge | null>;
  deleteChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string
  ): Promise<void>;
  countActiveChallenges(tenantId: string, now?: Date): Promise<number>;
  pruneExpired(tenantId: string, now?: Date): Promise<void>;

  getTotpReplayState(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now?: Date
  ): Promise<OtpTotpReplayState | null>;
  persistTotpReplay(state: OtpTotpReplayState, now?: Date): Promise<boolean>;
  getTotpFailureState(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now?: Date
  ): Promise<OtpTotpFailureState | null>;
  recordTotpFailure(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now?: Date,
    windowSeconds?: number
  ): Promise<OtpTotpFailureState | null>;
  clearTotpFailure(
    tenantId: string,
    tokenId: string,
    purpose: string
  ): Promise<void>;
  countTotpReplayStates(tenantId: string, now?: Date): Promise<number>;
  countTotpFailureStates(tenantId: string, now?: Date): Promise<number>;
}

function key(tenantId: string, tokenId: string, purpose: string): string {
  return `${tenantId}\u0000${tokenId}\u0000${purpose}`;
}

function copyChallenge(challenge: StoredOtpChallenge): StoredOtpChallenge {
  return {
    ...challenge,
    expiresAt: new Date(challenge.expiresAt),
    consumedAt: challenge.consumedAt ? new Date(challenge.consumedAt) : null,
  };
}

function copyReplayState(state: OtpTotpReplayState): OtpTotpReplayState {
  return { ...state, expiresAt: new Date(state.expiresAt) };
}

function copyFailureState(state: OtpTotpFailureState): OtpTotpFailureState {
  return { ...state, expiresAt: new Date(state.expiresAt) };
}

@Injectable()
export class InMemoryOtpChallengeStore implements OtpChallengeStore {
  readonly requiresTenantContext = false;
  private readonly challenges = new Map<string, StoredOtpChallenge>();
  private readonly replayStates = new Map<string, OtpTotpReplayState>();
  private readonly failureStates = new Map<string, OtpTotpFailureState>();

  async storeChallenge(challenge: StoredOtpChallenge): Promise<void> {
    this.challenges.set(
      key(challenge.tenantId, challenge.tokenId, challenge.purpose),
      copyChallenge(challenge)
    );
  }

  async getChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now = new Date()
  ): Promise<StoredOtpChallenge | null> {
    const stateKey = key(tenantId, tokenId, purpose);
    const challenge = this.challenges.get(stateKey);
    if (!challenge) return null;
    if (
      challenge.expiresAt.getTime() <= now.getTime() ||
      challenge.consumedAt
    ) {
      this.challenges.delete(stateKey);
      return null;
    }
    return copyChallenge(challenge);
  }

  async recordFailedAttempt(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now = new Date()
  ): Promise<StoredOtpChallenge | null> {
    const stateKey = key(tenantId, tokenId, purpose);
    const challenge = this.challenges.get(stateKey);
    if (!challenge) return null;
    if (
      challenge.expiresAt.getTime() <= now.getTime() ||
      challenge.consumedAt
    ) {
      this.challenges.delete(stateKey);
      return null;
    }
    if (challenge.attemptCount < maxAttempts) {
      challenge.attemptCount += 1;
    }
    return copyChallenge(challenge);
  }

  async consumeChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now = new Date()
  ): Promise<StoredOtpChallenge | null> {
    const stateKey = key(tenantId, tokenId, purpose);
    const challenge = this.challenges.get(stateKey);
    if (
      !challenge ||
      challenge.expiresAt.getTime() <= now.getTime() ||
      challenge.consumedAt ||
      challenge.attemptCount >= maxAttempts
    ) {
      return null;
    }
    challenge.consumedAt = new Date(now);
    return copyChallenge(challenge);
  }

  async deleteChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string
  ): Promise<void> {
    this.challenges.delete(key(tenantId, tokenId, purpose));
  }

  async countActiveChallenges(
    tenantId: string,
    now = new Date()
  ): Promise<number> {
    await this.pruneExpired(tenantId, now);
    return Array.from(this.challenges.values()).filter(
      (challenge) => challenge.tenantId === tenantId
    ).length;
  }

  async pruneExpired(tenantId: string, now = new Date()): Promise<void> {
    for (const [stateKey, challenge] of this.challenges) {
      if (
        challenge.tenantId === tenantId &&
        (challenge.expiresAt.getTime() <= now.getTime() || challenge.consumedAt)
      ) {
        this.challenges.delete(stateKey);
      }
    }
  }

  async getTotpReplayState(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now = new Date()
  ): Promise<OtpTotpReplayState | null> {
    const stateKey = key(tenantId, tokenId, purpose);
    const state = this.replayStates.get(stateKey);
    if (!state) return null;
    if (state.expiresAt.getTime() <= now.getTime()) {
      this.replayStates.delete(stateKey);
      return null;
    }
    return copyReplayState(state);
  }

  async persistTotpReplay(
    state: OtpTotpReplayState,
    now = new Date()
  ): Promise<boolean> {
    const stateKey = key(state.tenantId, state.tokenId, state.purpose);
    const existing = this.replayStates.get(stateKey);
    if (
      existing &&
      existing.expiresAt.getTime() > now.getTime() &&
      existing.lastAcceptedCounter >= state.lastAcceptedCounter
    ) {
      return false;
    }
    this.replayStates.set(stateKey, copyReplayState(state));
    return true;
  }

  async getTotpFailureState(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now = new Date()
  ): Promise<OtpTotpFailureState | null> {
    const stateKey = key(tenantId, tokenId, purpose);
    const state = this.failureStates.get(stateKey);
    if (!state) return null;
    if (state.expiresAt.getTime() <= now.getTime()) {
      this.failureStates.delete(stateKey);
      return null;
    }
    return copyFailureState(state);
  }

  async recordTotpFailure(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now = new Date(),
    windowSeconds = 30
  ): Promise<OtpTotpFailureState | null> {
    const stateKey = key(tenantId, tokenId, purpose);
    const existing = this.failureStates.get(stateKey);
    if (existing && existing.expiresAt.getTime() <= now.getTime()) {
      this.failureStates.delete(stateKey);
    }
    const state = this.failureStates.get(stateKey) || {
      tenantId,
      tokenId,
      purpose,
      attempts: 0,
      expiresAt: new Date(
        now.getTime() + Math.max(60000, windowSeconds * 2000)
      ),
    };
    if (state.attempts < maxAttempts) {
      state.attempts += 1;
    }
    state.expiresAt = new Date(
      now.getTime() + Math.max(60000, windowSeconds * 2000)
    );
    this.failureStates.set(stateKey, state);
    return copyFailureState(state);
  }

  async clearTotpFailure(
    tenantId: string,
    tokenId: string,
    purpose: string
  ): Promise<void> {
    this.failureStates.delete(key(tenantId, tokenId, purpose));
  }

  async countTotpReplayStates(
    tenantId: string,
    now = new Date()
  ): Promise<number> {
    for (const [stateKey, state] of this.replayStates) {
      if (
        state.tenantId === tenantId &&
        state.expiresAt.getTime() <= now.getTime()
      ) {
        this.replayStates.delete(stateKey);
      }
    }
    return Array.from(this.replayStates.values()).filter(
      (state) => state.tenantId === tenantId
    ).length;
  }

  async countTotpFailureStates(
    tenantId: string,
    now = new Date()
  ): Promise<number> {
    for (const [stateKey, state] of this.failureStates) {
      if (
        state.tenantId === tenantId &&
        state.expiresAt.getTime() <= now.getTime()
      ) {
        this.failureStates.delete(stateKey);
      }
    }
    return Array.from(this.failureStates.values()).filter(
      (state) => state.tenantId === tenantId
    ).length;
  }
}

@Injectable()
export class TypeOrmOtpChallengeStore implements OtpChallengeStore {
  readonly requiresTenantContext = true;

  constructor(private readonly dataSource: DataSource) {}

  private async inTenant<T>(
    tenantId: string,
    operation: (repository: Repository<OtpChallengeEntity>) => Promise<T>
  ): Promise<T> {
    return withTenantRlsTransaction(
      this.dataSource,
      tenantId,
      async (manager) => {
        const repository = (manager as unknown as EntityManager).getRepository(
          OtpChallengeEntity
        );
        return operation(repository);
      }
    );
  }

  private toChallenge(entity: OtpChallengeEntity): StoredOtpChallenge {
    return {
      tokenId: entity.tokenId,
      tenantId: entity.tenantId,
      purpose: entity.purpose,
      codeHash: entity.codeHash || '',
      codeSalt: entity.codeSalt || '',
      expiresAt: new Date(entity.expiresAt),
      attemptCount: entity.attemptCount || 0,
      consumedAt: entity.consumedAt ? new Date(entity.consumedAt) : null,
    };
  }

  private toReplayState(entity: OtpChallengeEntity): OtpTotpReplayState {
    return {
      tokenId: entity.tokenId,
      tenantId: entity.tenantId,
      purpose: entity.purpose,
      lastAcceptedCounter: Number(entity.lastAcceptedCounter || 0),
      expiresAt: new Date(entity.expiresAt),
      windowSeconds: entity.windowSeconds || 30,
    };
  }

  private toFailureState(entity: OtpChallengeEntity): OtpTotpFailureState {
    return {
      tokenId: entity.tokenId,
      tenantId: entity.tenantId,
      purpose: entity.purpose,
      attempts: entity.attemptCount || 0,
      expiresAt: new Date(entity.expiresAt),
    };
  }

  async storeChallenge(challenge: StoredOtpChallenge): Promise<void> {
    await this.inTenant(challenge.tenantId, async (repository) => {
      const existing = await repository.findOne({
        where: {
          tenantId: challenge.tenantId,
          tokenId: challenge.tokenId,
          purpose: challenge.purpose,
          stateType: 'session',
        },
      });
      const entity = repository.create({
        ...(existing ? { id: existing.id } : {}),
        tenantId: challenge.tenantId,
        tokenId: challenge.tokenId,
        purpose: challenge.purpose,
        stateType: 'session',
        codeHash: challenge.codeHash,
        codeSalt: challenge.codeSalt,
        expiresAt: challenge.expiresAt,
        attemptCount: challenge.attemptCount,
        consumedAt: challenge.consumedAt,
      });
      await repository.save(entity);
    });
  }

  async getChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now = new Date()
  ): Promise<StoredOtpChallenge | null> {
    return this.inTenant(tenantId, async (repository) => {
      const entity = await repository.findOne({
        where: {
          tenantId,
          tokenId,
          purpose,
          stateType: 'session',
          expiresAt: MoreThan(now),
          consumedAt: IsNull(),
        },
      });
      return entity ? this.toChallenge(entity) : null;
    });
  }

  async recordFailedAttempt(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now = new Date()
  ): Promise<StoredOtpChallenge | null> {
    return this.inTenant(tenantId, async (repository) => {
      await repository
        .createQueryBuilder()
        .update(OtpChallengeEntity)
        .set({ attemptCount: () => '"attemptCount" + 1' })
        .where('"tenantId" = :tenantId', { tenantId })
        .andWhere('"tokenId" = :tokenId', { tokenId })
        .andWhere('"purpose" = :purpose', { purpose })
        .andWhere('"stateType" = :stateType', { stateType: 'session' })
        .andWhere('"expiresAt" > :now', { now })
        .andWhere('"consumedAt" IS NULL')
        .andWhere('"attemptCount" < :maxAttempts', { maxAttempts })
        .execute();
      const entity = await repository.findOne({
        where: {
          tenantId,
          tokenId,
          purpose,
          stateType: 'session',
          expiresAt: MoreThan(now),
          consumedAt: IsNull(),
        },
      });
      return entity ? this.toChallenge(entity) : null;
    });
  }

  async consumeChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now = new Date()
  ): Promise<StoredOtpChallenge | null> {
    return this.inTenant(tenantId, async (repository) => {
      const result = await repository
        .createQueryBuilder()
        .update(OtpChallengeEntity)
        .set({ consumedAt: now })
        .where('"tenantId" = :tenantId', { tenantId })
        .andWhere('"tokenId" = :tokenId', { tokenId })
        .andWhere('"purpose" = :purpose', { purpose })
        .andWhere('"stateType" = :stateType', { stateType: 'session' })
        .andWhere('"expiresAt" > :now', { now })
        .andWhere('"consumedAt" IS NULL')
        .andWhere('"attemptCount" < :maxAttempts', { maxAttempts })
        .execute();
      if (!result.affected) return null;
      const entity = await repository.findOne({
        where: {
          tenantId,
          tokenId,
          purpose,
          stateType: 'session',
        },
      });
      return entity ? this.toChallenge(entity) : null;
    });
  }

  async deleteChallenge(
    tenantId: string,
    tokenId: string,
    purpose: string
  ): Promise<void> {
    await this.inTenant(tenantId, async (repository) => {
      await repository.delete({
        tenantId,
        tokenId,
        purpose,
        stateType: 'session',
      });
    });
  }

  async countActiveChallenges(
    tenantId: string,
    now = new Date()
  ): Promise<number> {
    return this.inTenant(tenantId, (repository) =>
      repository.count({
        where: {
          tenantId,
          stateType: 'session',
          expiresAt: MoreThan(now),
          consumedAt: IsNull(),
        },
      })
    );
  }

  async pruneExpired(tenantId: string, now = new Date()): Promise<void> {
    await this.inTenant(tenantId, async (repository) => {
      await repository
        .createQueryBuilder()
        .delete()
        .from(OtpChallengeEntity)
        .where('"tenantId" = :tenantId', { tenantId })
        .andWhere('("expiresAt" <= :now OR "consumedAt" IS NOT NULL)', { now })
        .execute();
    });
  }

  async getTotpReplayState(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now = new Date()
  ): Promise<OtpTotpReplayState | null> {
    return this.inTenant(tenantId, async (repository) => {
      const entity = await repository.findOne({
        where: {
          tenantId,
          tokenId,
          purpose,
          stateType: 'totp_replay',
          expiresAt: MoreThan(now),
        },
      });
      return entity ? this.toReplayState(entity) : null;
    });
  }

  async persistTotpReplay(
    state: OtpTotpReplayState,
    now = new Date()
  ): Promise<boolean> {
    return this.inTenant(state.tenantId, async (repository) => {
      const existing = await repository.findOne({
        where: {
          tenantId: state.tenantId,
          tokenId: state.tokenId,
          purpose: state.purpose,
          stateType: 'totp_replay',
        },
      });
      const updateExisting = () =>
        repository
          .createQueryBuilder()
          .update(OtpChallengeEntity)
          .set({
            expiresAt: state.expiresAt,
            attemptCount: 0,
            lastAcceptedCounter: state.lastAcceptedCounter,
            windowSeconds: state.windowSeconds,
          })
          .where('"tenantId" = :tenantId', { tenantId: state.tenantId })
          .andWhere('"tokenId" = :tokenId', { tokenId: state.tokenId })
          .andWhere('"purpose" = :purpose', { purpose: state.purpose })
          .andWhere('"stateType" = :stateType', { stateType: 'totp_replay' })
          .andWhere(
            '("expiresAt" <= :now OR "lastAcceptedCounter" IS NULL OR "lastAcceptedCounter" < :counter)',
            { now, counter: state.lastAcceptedCounter }
          )
          .execute();
      if (existing) {
        if (
          existing.expiresAt.getTime() > now.getTime() &&
          Number(existing.lastAcceptedCounter || 0) >= state.lastAcceptedCounter
        ) {
          return false;
        }
        return (await updateExisting()).affected === 1;
      }
      try {
        await repository.insert(
          repository.create({
            tenantId: state.tenantId,
            tokenId: state.tokenId,
            purpose: state.purpose,
            stateType: 'totp_replay',
            expiresAt: state.expiresAt,
            attemptCount: 0,
            lastAcceptedCounter: state.lastAcceptedCounter,
            windowSeconds: state.windowSeconds,
          })
        );
        return true;
      } catch {
        return (await updateExisting()).affected === 1;
      }
    });
  }

  async getTotpFailureState(
    tenantId: string,
    tokenId: string,
    purpose: string,
    now = new Date()
  ): Promise<OtpTotpFailureState | null> {
    return this.inTenant(tenantId, async (repository) => {
      const entity = await repository.findOne({
        where: {
          tenantId,
          tokenId,
          purpose,
          stateType: 'totp_failure',
          expiresAt: MoreThan(now),
        },
      });
      return entity ? this.toFailureState(entity) : null;
    });
  }

  async recordTotpFailure(
    tenantId: string,
    tokenId: string,
    purpose: string,
    maxAttempts: number,
    now = new Date(),
    windowSeconds = 30
  ): Promise<OtpTotpFailureState | null> {
    return this.inTenant(tenantId, async (repository) => {
      const expiresAt = new Date(
        now.getTime() + Math.max(60000, windowSeconds * 2000)
      );
      const existing = await repository.findOne({
        where: {
          tenantId,
          tokenId,
          purpose,
          stateType: 'totp_failure',
        },
      });
      const incrementExisting = () =>
        repository
          .createQueryBuilder()
          .update(OtpChallengeEntity)
          .set({
            attemptCount: () => '"attemptCount" + 1',
            expiresAt,
            windowSeconds,
          })
          .where('"tenantId" = :tenantId', { tenantId })
          .andWhere('"tokenId" = :tokenId', { tokenId })
          .andWhere('"purpose" = :purpose', { purpose })
          .andWhere('"stateType" = :stateType', { stateType: 'totp_failure' })
          .andWhere('"expiresAt" > :now', { now })
          .andWhere('"attemptCount" < :maxAttempts', { maxAttempts })
          .execute();
      if (existing && existing.expiresAt.getTime() > now.getTime()) {
        await incrementExisting();
        const current = await repository.findOne({
          where: {
            tenantId,
            tokenId,
            purpose,
            stateType: 'totp_failure',
          },
        });
        return current ? this.toFailureState(current) : null;
      }
      const entity = repository.create({
        ...(existing ? { id: existing.id } : {}),
        tenantId,
        tokenId,
        purpose,
        stateType: 'totp_failure',
        expiresAt,
        attemptCount: 1,
        windowSeconds,
      });
      try {
        await repository.save(entity);
        return this.toFailureState(entity);
      } catch {
        await incrementExisting();
        const current = await repository.findOne({
          where: {
            tenantId,
            tokenId,
            purpose,
            stateType: 'totp_failure',
          },
        });
        return current ? this.toFailureState(current) : null;
      }
    });
  }

  async clearTotpFailure(
    tenantId: string,
    tokenId: string,
    purpose: string
  ): Promise<void> {
    await this.inTenant(tenantId, async (repository) => {
      await repository.delete({
        tenantId,
        tokenId,
        purpose,
        stateType: 'totp_failure',
      });
    });
  }

  async countTotpReplayStates(
    tenantId: string,
    now = new Date()
  ): Promise<number> {
    return this.inTenant(tenantId, (repository) =>
      repository.count({
        where: {
          tenantId,
          stateType: 'totp_replay',
          expiresAt: MoreThan(now),
        },
      })
    );
  }

  async countTotpFailureStates(
    tenantId: string,
    now = new Date()
  ): Promise<number> {
    return this.inTenant(tenantId, (repository) =>
      repository.count({
        where: {
          tenantId,
          stateType: 'totp_failure',
          expiresAt: MoreThan(now),
        },
      })
    );
  }
}
