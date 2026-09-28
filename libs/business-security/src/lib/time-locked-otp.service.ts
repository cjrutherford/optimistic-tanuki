import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  OTP_CHALLENGE_STORE,
  OtpChallengeStore,
  OTP_TOTP_FAILURE_PURPOSE,
  OTP_TOTP_REPLAY_PURPOSE,
} from './otp-challenge.store';
import {
  OTP_SMS_DISPATCHER,
  OtpSmsDispatcher,
} from './twilio-otp-sms.dispatcher';
import { sanitizeTenantId } from './rls-session-binding';

export const MAX_OTP_SESSIONS = 1000;
export const MAX_OTP_VALIDITY_SECONDS = 900;
export const MAX_TOTP_REPLAY_KEYS = 1000;
export const MAX_TOTP_FAILED_ATTEMPT_KEYS = 1000;
export const MAX_TOTP_FAILED_ATTEMPTS = 3;
export const MAX_TOTP_CAPACITY_BLOCKED_KEYS = 1000;
export const TOTP_REPLAY_TTL_MS = 300000;
export const TOTP_FAILED_ATTEMPT_TTL_MS = 60000;
export const DEFAULT_OTP_TENANT_ID = '__legacy_otp__';
export const DEFAULT_OTP_PURPOSE = 'time-locked-otp';

export type TimeLockedOtpClock = () => number;
export type TimeLockedOtpSecretResolver = (
  tokenId: string
) => Promise<string | undefined> | string | undefined;

export interface OtpIssueRequest {
  tokenId: string;
  tenantId: string;
  purpose: string;
  phoneNumber: string;
  validitySeconds?: number;
}

export interface OtpIssueResult {
  expiresAt: Date;
  messageId: string;
}

export interface OtpVerificationContext {
  tenantId?: string;
  purpose?: string;
}

@Injectable()
export class TimeLockedOtpService {
  private readonly maxAttempts = MAX_TOTP_FAILED_ATTEMPTS;

  constructor(
    @Inject(OTP_CHALLENGE_STORE)
    private readonly challengeStore: OtpChallengeStore,
    @Inject(OTP_SMS_DISPATCHER)
    private readonly smsDispatcher: OtpSmsDispatcher,
    @Optional() private readonly clock: TimeLockedOtpClock = Date.now
  ) {}

  async issueOtp(request: OtpIssueRequest): Promise<OtpIssueResult> {
    this.validateIssueRequest(request);
    const validitySeconds = request.validitySeconds ?? 90;
    this.validateValiditySeconds(validitySeconds);
    const tenantId = this.getTenantId(request.tenantId);
    const purpose = request.purpose.trim();
    const now = this.clock();
    const expiresAt = new Date(now + validitySeconds * 1000);

    await this.challengeStore.pruneExpired(tenantId, new Date(now));
    await this.challengeStore.deleteChallenge(
      tenantId,
      request.tokenId.trim(),
      purpose
    );
    if (
      (await this.challengeStore.countActiveChallenges(
        tenantId,
        new Date(now)
      )) >= MAX_OTP_SESSIONS
    ) {
      throw new ServiceUnavailableException('OTP session capacity reached.');
    }

    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const codeSalt = crypto.randomBytes(16).toString('hex');
    await this.challengeStore.storeChallenge({
      tokenId: request.tokenId.trim(),
      tenantId,
      purpose,
      codeHash: this.hashCode(code, codeSalt),
      codeSalt,
      expiresAt,
      attemptCount: 0,
      consumedAt: null,
    });

    try {
      const delivery = await this.smsDispatcher.dispatchOtp({
        to: request.phoneNumber,
        code,
        tenantId,
        purpose,
      });
      if (
        !delivery ||
        typeof delivery.messageId !== 'string' ||
        !delivery.messageId
      ) {
        throw new ServiceUnavailableException(
          'OTP SMS delivery did not return a message id; issuance denied.'
        );
      }
      return { expiresAt: new Date(expiresAt), messageId: delivery.messageId };
    } catch (error) {
      await this.challengeStore.deleteChallenge(
        tenantId,
        request.tokenId.trim(),
        purpose
      );
      throw error;
    }
  }

  async generateOtp(request: OtpIssueRequest): Promise<OtpIssueResult> {
    return this.issueOtp(request);
  }

  async verifyOtp(
    tokenId: string,
    inputCode: string,
    secret?: string,
    windowSeconds = 30,
    context?: OtpVerificationContext
  ): Promise<boolean> {
    const cleanCode = this.normalizeCode(inputCode);
    if (!cleanCode || typeof tokenId !== 'string' || !tokenId.trim()) {
      return false;
    }

    const now = this.clock();
    const tenantId = this.getTenantId(context?.tenantId);
    const purpose = context?.purpose?.trim() || DEFAULT_OTP_PURPOSE;
    await this.challengeStore.pruneExpired(tenantId, new Date(now));
    const session = await this.challengeStore.getChallenge(
      tenantId,
      tokenId.trim(),
      purpose,
      new Date(now)
    );
    if (session) {
      if (session.attemptCount >= this.maxAttempts) {
        return false;
      }
      if (this.matchesHash(session.codeHash, session.codeSalt, cleanCode)) {
        const consumed = await this.challengeStore.consumeChallenge(
          tenantId,
          tokenId.trim(),
          purpose,
          this.maxAttempts,
          new Date(now)
        );
        if (consumed) return true;
      } else {
        await this.challengeStore.recordFailedAttempt(
          tenantId,
          tokenId.trim(),
          purpose,
          this.maxAttempts,
          new Date(now)
        );
      }
    }

    if (!secret) return false;
    return this.verifyRollingTotp(secret, cleanCode, windowSeconds, tokenId, {
      tenantId,
      purpose,
    });
  }

  generateRollingTotp(
    secret: string,
    windowSeconds = 30,
    timeOffsetSteps = 0
  ): string {
    const counter = this.getCounter(windowSeconds) + timeOffsetSteps;
    return this.generateTotpForCounter(secret, counter);
  }

  async verifyRollingTotp(
    secret: string,
    code: string,
    windowSeconds = 30,
    tokenId = 'direct',
    context?: OtpVerificationContext
  ): Promise<boolean> {
    const cleanCode = this.normalizeCode(code);
    if (
      !cleanCode ||
      !secret ||
      typeof tokenId !== 'string' ||
      !tokenId.trim()
    ) {
      return false;
    }

    const now = this.clock();
    const tenantId = this.getTenantId(context?.tenantId);
    const purpose = context?.purpose?.trim() || DEFAULT_OTP_PURPOSE;
    const safeWindowSeconds = this.normalizeWindowSeconds(windowSeconds);
    const replayKey = this.getReplayKey(
      tokenId.trim(),
      secret,
      safeWindowSeconds
    );
    const replayState = await this.challengeStore.getTotpReplayState(
      tenantId,
      replayKey,
      OTP_TOTP_REPLAY_PURPOSE,
      new Date(now)
    );
    const failureState = await this.challengeStore.getTotpFailureState(
      tenantId,
      replayKey,
      OTP_TOTP_FAILURE_PURPOSE,
      new Date(now)
    );
    if (failureState && failureState.attempts >= MAX_TOTP_FAILED_ATTEMPTS) {
      return false;
    }
    if (!replayState) {
      const replayCount = await this.challengeStore.countTotpReplayStates(
        tenantId,
        new Date(now)
      );
      if (replayCount >= MAX_TOTP_REPLAY_KEYS) return false;
    }
    if (!failureState) {
      const failureCount = await this.challengeStore.countTotpFailureStates(
        tenantId,
        new Date(now)
      );
      if (failureCount >= MAX_TOTP_FAILED_ATTEMPT_KEYS) return false;
    }

    const currentCounter = this.getCounter(safeWindowSeconds);
    const lastAcceptedCounter = replayState?.lastAcceptedCounter;
    let matchedCounter: number | null = null;
    for (const step of [0, -1, 1]) {
      const counter = currentCounter + step;
      const candidate = this.generateTotpForCounter(secret, counter);
      if (
        this.constantTimeEquals(candidate, cleanCode) &&
        (lastAcceptedCounter === undefined || counter > lastAcceptedCounter) &&
        (matchedCounter === null || counter > matchedCounter)
      ) {
        matchedCounter = counter;
      }
    }

    if (matchedCounter === null) {
      await this.challengeStore.recordTotpFailure(
        tenantId,
        replayKey,
        OTP_TOTP_FAILURE_PURPOSE,
        MAX_TOTP_FAILED_ATTEMPTS,
        new Date(now),
        safeWindowSeconds
      );
      return false;
    }

    const accepted = await this.challengeStore.persistTotpReplay(
      {
        tenantId,
        tokenId: replayKey,
        purpose: OTP_TOTP_REPLAY_PURPOSE,
        lastAcceptedCounter: matchedCounter,
        expiresAt: new Date(now + this.getTotpStateTtlMs(safeWindowSeconds)),
        windowSeconds: safeWindowSeconds,
      },
      new Date(now)
    );
    if (!accepted) return false;
    await this.challengeStore.clearTotpFailure(
      tenantId,
      replayKey,
      OTP_TOTP_FAILURE_PURPOSE
    );
    return true;
  }

  generateRfc6238Secret(): string {
    return TimeLockedOtpService.base32Encode(crypto.randomBytes(20));
  }

  rfc6238TotpForCounter(
    base32Secret: string,
    counter: number,
    digits = 6
  ): string {
    const key = TimeLockedOtpService.base32Decode(base32Secret);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return (binary % 10 ** digits).toString().padStart(digits, '0');
  }

  async verifyRfc6238Totp(
    base32Secret: string,
    inputCode: string,
    tokenId: string,
    context?: OtpVerificationContext & { digits?: number; windowSteps?: number }
  ): Promise<boolean> {
    const digits = context?.digits === 8 ? 8 : 6;
    const cleanCode =
      typeof inputCode === 'string' &&
      new RegExp(`^\\d{${digits}}$`).test(inputCode.trim())
        ? inputCode.trim()
        : null;
    if (
      !cleanCode ||
      typeof base32Secret !== 'string' ||
      !base32Secret.trim() ||
      typeof tokenId !== 'string' ||
      !tokenId.trim()
    ) {
      return false;
    }
    let key: Buffer;
    try {
      key = TimeLockedOtpService.base32Decode(base32Secret.trim());
    } catch {
      return false;
    }
    if (key.length < 16) {
      return false;
    }

    const now = this.clock();
    const tenantId = this.getTenantId(context?.tenantId);
    const purpose = context?.purpose?.trim() || DEFAULT_OTP_PURPOSE;
    const windowSteps =
      Number.isSafeInteger(context?.windowSteps) &&
      (context?.windowSteps as number) >= 0 &&
      (context?.windowSteps as number) <= 2
        ? (context?.windowSteps as number)
        : 1;
    const replayKey = `rfc6238:${tokenId.trim()}:${purpose}:${key
      .subarray(0, 8)
      .toString('hex')}`;
    const replayState = await this.challengeStore.getTotpReplayState(
      tenantId,
      replayKey,
      OTP_TOTP_REPLAY_PURPOSE,
      new Date(now)
    );
    const failureState = await this.challengeStore.getTotpFailureState(
      tenantId,
      replayKey,
      OTP_TOTP_FAILURE_PURPOSE,
      new Date(now)
    );
    if (failureState && failureState.attempts >= MAX_TOTP_FAILED_ATTEMPTS) {
      return false;
    }
    if (!replayState) {
      const replayCount = await this.challengeStore.countTotpReplayStates(
        tenantId,
        new Date(now)
      );
      if (replayCount >= MAX_TOTP_REPLAY_KEYS) return false;
    }
    if (!failureState) {
      const failureCount = await this.challengeStore.countTotpFailureStates(
        tenantId,
        new Date(now)
      );
      if (failureCount >= MAX_TOTP_FAILED_ATTEMPT_KEYS) return false;
    }

    const currentCounter = this.getCounter(30);
    const lastAcceptedCounter = replayState?.lastAcceptedCounter;
    let matchedCounter: number | null = null;
    for (let step = -windowSteps; step <= windowSteps; step += 1) {
      const counter = currentCounter + step;
      if (counter < 0) continue;
      const candidate = this.rfc6238TotpForCounter(
        base32Secret.trim(),
        counter,
        digits
      );
      if (
        this.constantTimeEquals(candidate, cleanCode) &&
        (lastAcceptedCounter === undefined || counter > lastAcceptedCounter) &&
        (matchedCounter === null || counter > matchedCounter)
      ) {
        matchedCounter = counter;
      }
    }

    if (matchedCounter === null) {
      await this.challengeStore.recordTotpFailure(
        tenantId,
        replayKey,
        OTP_TOTP_FAILURE_PURPOSE,
        MAX_TOTP_FAILED_ATTEMPTS,
        new Date(now),
        30
      );
      return false;
    }

    const accepted = await this.challengeStore.persistTotpReplay(
      {
        tenantId,
        tokenId: replayKey,
        purpose: OTP_TOTP_REPLAY_PURPOSE,
        lastAcceptedCounter: matchedCounter,
        expiresAt: new Date(now + this.getTotpStateTtlMs(30)),
        windowSeconds: 30,
      },
      new Date(now)
    );
    if (!accepted) return false;
    await this.challengeStore.clearTotpFailure(
      tenantId,
      replayKey,
      OTP_TOTP_FAILURE_PURPOSE
    );
    return true;
  }

  static base32Encode(data: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of data) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
  }

  static base32Decode(input: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = input.trim().replace(/=+$/, '').toUpperCase();
    if (!clean || /[^A-Z2-7]/.test(clean)) {
      throw new Error('Invalid base32 secret.');
    }
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of clean) {
      value = (value << 5) | alphabet.indexOf(char);
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  async getActiveSessionCount(
    tenantId = DEFAULT_OTP_TENANT_ID
  ): Promise<number> {
    return this.challengeStore.countActiveChallenges(
      this.getTenantId(tenantId),
      new Date(this.clock())
    );
  }

  async getTotpReplayStateCount(
    tenantId = DEFAULT_OTP_TENANT_ID
  ): Promise<number> {
    return this.challengeStore.countTotpReplayStates(
      this.getTenantId(tenantId),
      new Date(this.clock())
    );
  }

  async getTotpFailedAttemptCount(
    tenantId = DEFAULT_OTP_TENANT_ID
  ): Promise<number> {
    return this.challengeStore.countTotpFailureStates(
      this.getTenantId(tenantId),
      new Date(this.clock())
    );
  }

  private getCounter(windowSeconds: number): number {
    const stepSeconds = this.normalizeWindowSeconds(windowSeconds);
    return Math.floor(this.clock() / 1000 / stepSeconds);
  }

  private getTotpStateTtlMs(windowSeconds: number): number {
    return Math.max(
      TOTP_REPLAY_TTL_MS,
      this.normalizeWindowSeconds(windowSeconds) * 2000
    );
  }

  private generateTotpForCounter(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha256', secret).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return (binary % 1000000).toString().padStart(6, '0');
  }

  private getReplayKey(
    tokenId: string,
    secret: string,
    windowSeconds: number
  ): string {
    return crypto
      .createHash('sha256')
      .update(`${tokenId}\u0000${secret}\u0000${windowSeconds}`)
      .digest('hex');
  }

  private hashCode(code: string, salt: string): string {
    return crypto
      .createHmac('sha256', Buffer.from(salt, 'hex'))
      .update(code, 'utf8')
      .digest('hex');
  }

  private matchesHash(hash: string, salt: string, code: string): boolean {
    if (!/^[a-f0-9]{64}$/i.test(hash) || !/^[a-f0-9]{32}$/i.test(salt))
      return false;
    return this.constantTimeEquals(
      hash.toLowerCase(),
      this.hashCode(code, salt)
    );
  }

  private validateIssueRequest(request: OtpIssueRequest): void {
    if (!request || typeof request !== 'object') {
      throw new BadRequestException('OTP issuance details are required.');
    }
    if (typeof request.tokenId !== 'string' || !request.tokenId.trim()) {
      throw new BadRequestException('OTP token identifier is required.');
    }
    if (typeof request.tenantId !== 'string' || !request.tenantId.trim()) {
      throw new BadRequestException('OTP tenant context is required.');
    }
    if (typeof request.purpose !== 'string' || !request.purpose.trim()) {
      throw new BadRequestException('OTP purpose is required.');
    }
    if (
      typeof request.phoneNumber !== 'string' ||
      !request.phoneNumber.trim()
    ) {
      throw new BadRequestException('OTP SMS destination is required.');
    }
  }

  private validateValiditySeconds(value: number): void {
    if (
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value <= 0 ||
      value > MAX_OTP_VALIDITY_SECONDS
    ) {
      throw new BadRequestException(
        `OTP validity must be an integer between 1 and ${MAX_OTP_VALIDITY_SECONDS} seconds.`
      );
    }
  }

  private getTenantId(value?: string): string {
    if (!value && this.challengeStore.requiresTenantContext === true) {
      throw new BadRequestException(
        'Tenant context is required for persistent OTP verification.'
      );
    }
    try {
      return sanitizeTenantId(value || DEFAULT_OTP_TENANT_ID);
    } catch {
      throw new BadRequestException('OTP tenant context is invalid.');
    }
  }

  private normalizeWindowSeconds(windowSeconds: number): number {
    return Number.isFinite(windowSeconds) && windowSeconds > 0
      ? windowSeconds
      : 30;
  }

  private normalizeCode(inputCode: string): string | null {
    if (typeof inputCode !== 'string') return null;
    const cleanCode = inputCode.trim();
    return /^\d{6}$/.test(cleanCode) ? cleanCode : null;
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }
}
