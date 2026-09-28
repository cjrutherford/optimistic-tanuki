import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import * as crypto from 'crypto';
import {
  sanitizeTenantId,
  withTenantRlsTransaction,
} from '@optimistic-tanuki/business-security';
import { DataSource, EntityManager } from 'typeorm';
import { VaultTokenEntity } from '../../entities/vault-token.entity';

export const VAULT_TOKEN_PURPOSES = {
  DOCUMENT_DROP: 'document-drop',
  ESCROW_WIRE: 'escrow-wire',
} as const;

export type VaultTokenPurpose =
  (typeof VAULT_TOKEN_PURPOSES)[keyof typeof VAULT_TOKEN_PURPOSES];

export interface VaultTokenIssue {
  tenantId: string;
  documentId: string;
  purpose: VaultTokenPurpose;
  expiresInSeconds?: number;
  issuedBy?: string;
}

export interface VaultTokenClaims {
  tenantId: string;
  documentId: string;
  purpose: VaultTokenPurpose;
  jti: string;
  iat: number;
  exp: number;
}

export interface VaultTokenCheck {
  token: string;
  purpose?: VaultTokenPurpose;
  expectedTenantId?: string;
  expectedDocumentId?: string;
}

type RpcStatus = 400 | 401 | 403 | 503;

@Injectable()
export class VaultTokenService {
  private readonly logger = new Logger(VaultTokenService.name);
  private readonly maxTokenLength = 4096;
  private readonly maxTtlSeconds = 86400;

  constructor(
    @Inject('FINANCE_CONNECTION')
    private readonly dataSource: DataSource
  ) {}

  async issue(input: VaultTokenIssue): Promise<string> {
    const tenantId = this.requireTenantId(input?.tenantId, 400);
    const documentId = this.requireDocumentId(input?.documentId, 400);
    const purpose = this.requirePurpose(input?.purpose, 400);
    const expiresInSeconds = input?.expiresInSeconds ?? 900;
    if (
      !Number.isSafeInteger(expiresInSeconds) ||
      expiresInSeconds < 1 ||
      expiresInSeconds > this.maxTtlSeconds
    ) {
      this.fail(
        400,
        'Vault token expiry must be between one second and one day.'
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const claims: VaultTokenClaims = {
      tenantId,
      documentId,
      purpose,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + (expiresInSeconds as number),
    };

    await withTenantRlsTransaction(
      this.dataSource,
      tenantId,
      async (manager) => {
        const repository = (manager as unknown as EntityManager).getRepository(
          VaultTokenEntity
        );
        await repository.insert({
          jti: claims.jti,
          tenantId,
          documentId,
          purpose,
          expiresAt: new Date(claims.exp * 1000),
          issuedBy:
            typeof input?.issuedBy === 'string' && input.issuedBy.trim()
              ? input.issuedBy.trim().slice(0, 255)
              : null,
        });
      }
    );

    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  async validate(check: VaultTokenCheck): Promise<VaultTokenClaims> {
    const parsed = this.verify(check?.token, check?.purpose, true);
    const record = await this.findRecord(parsed.jti, parsed.tenantId);
    if (!record) {
      this.fail(401, 'Vault token is not active.');
    }
    if (record.revokedAt) {
      this.fail(403, 'Vault token has been revoked.');
    }
    if (record.consumedAt) {
      this.fail(401, 'Vault token has already been used.');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      this.fail(401, 'Vault token is invalid or expired.');
    }
    this.matchContext(
      parsed,
      record,
      check?.expectedTenantId,
      check?.expectedDocumentId
    );
    return parsed;
  }

  async consume(check: VaultTokenCheck): Promise<VaultTokenClaims> {
    const parsed = this.verify(check?.token, check?.purpose, true);
    await withTenantRlsTransaction(
      this.dataSource,
      parsed.tenantId,
      async (manager) => {
        const repository = (manager as unknown as EntityManager).getRepository(
          VaultTokenEntity
        );
        const record = await repository.findOne({
          where: { jti: parsed.jti },
          lock: { mode: 'pessimistic_write' },
        });
        if (!record) {
          this.fail(401, 'Vault token is not active.');
        }
        if (record.revokedAt) {
          this.fail(403, 'Vault token has been revoked.');
        }
        if (record.consumedAt) {
          this.fail(401, 'Vault token has already been used.');
        }
        if (record.expiresAt.getTime() <= Date.now()) {
          this.fail(401, 'Vault token is invalid or expired.');
        }
        this.matchContext(
          parsed,
          record,
          check?.expectedTenantId,
          check?.expectedDocumentId
        );
        record.consumedAt = new Date();
        await repository.save(record);
      }
    );
    this.logger.log(
      `Consumed vault token ${parsed.jti} for ${parsed.purpose}.`
    );
    return parsed;
  }

  async revoke(rawToken: string): Promise<VaultTokenClaims> {
    const parsed = this.verify(rawToken, undefined, false);
    await withTenantRlsTransaction(
      this.dataSource,
      parsed.tenantId,
      async (manager) => {
        const repository = (manager as unknown as EntityManager).getRepository(
          VaultTokenEntity
        );
        const record = await repository.findOne({
          where: { jti: parsed.jti },
          lock: { mode: 'pessimistic_write' },
        });
        if (!record) {
          this.fail(401, 'Vault token is not active.');
        }
        if (!record.revokedAt) {
          record.revokedAt = new Date();
          await repository.save(record);
        }
      }
    );
    return parsed;
  }

  private async findRecord(
    jti: string,
    tenantId: string
  ): Promise<VaultTokenEntity> {
    return withTenantRlsTransaction(
      this.dataSource,
      tenantId,
      async (manager) => {
        const repository = (manager as unknown as EntityManager).getRepository(
          VaultTokenEntity
        );
        return repository.findOne({ where: { jti } });
      }
    );
  }

  private matchContext(
    parsed: VaultTokenClaims,
    record: VaultTokenEntity,
    expectedTenantId: string | undefined,
    expectedDocumentId: string | undefined
  ): void {
    if (
      record.tenantId !== parsed.tenantId ||
      record.purpose !== parsed.purpose
    ) {
      this.fail(401, 'Vault token is invalid.');
    }
    if (expectedTenantId !== undefined) {
      const normalized = this.requireTenantId(expectedTenantId, 403);
      if (parsed.tenantId !== normalized) {
        this.fail(
          403,
          'Vault token is not valid for the authenticated tenant.'
        );
      }
    }
    if (expectedDocumentId !== undefined) {
      const normalized = this.requireDocumentId(expectedDocumentId, 403);
      if (parsed.documentId !== normalized) {
        this.fail(403, 'Vault token is not valid for the requested document.');
      }
    }
  }

  private verify(
    rawToken: unknown,
    expectedPurpose: VaultTokenPurpose | undefined,
    enforceExpiry: boolean
  ): VaultTokenClaims {
    if (typeof rawToken !== 'string' || !rawToken.trim()) {
      this.fail(401, 'A vault token is required.');
    }
    const token = (rawToken as string).trim();
    if (token.length > this.maxTokenLength) {
      this.fail(401, 'Vault token is invalid.');
    }
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      this.fail(401, 'Vault token is invalid.');
    }
    const expectedSignature = this.sign(parts[0]);
    if (!this.constantTimeEqual(parts[1], expectedSignature)) {
      this.fail(401, 'Vault token is invalid.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
      this.fail(401, 'Vault token is invalid.');
    }
    if (!this.isRecord(parsed)) {
      this.fail(401, 'Vault token is invalid.');
    }
    const claims = parsed as Partial<VaultTokenClaims>;
    let tenantId: string;
    let documentId: string;
    let purpose: VaultTokenPurpose;
    try {
      tenantId = this.requireTenantId(claims.tenantId, 401);
      documentId = this.requireDocumentId(claims.documentId, 401);
      purpose = this.requirePurpose(claims.purpose, 401);
    } catch {
      this.fail(401, 'Vault token is invalid.');
    }
    const { jti, iat, exp } = claims as {
      jti: unknown;
      iat: unknown;
      exp: unknown;
    };
    if (
      typeof jti !== 'string' ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(jti) ||
      !Number.isSafeInteger(iat) ||
      !Number.isSafeInteger(exp) ||
      (exp as number) <= (iat as number) ||
      (exp as number) - (iat as number) > this.maxTtlSeconds
    ) {
      this.fail(401, 'Vault token is invalid.');
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      (iat as number) > now + 60 ||
      (enforceExpiry && (exp as number) <= now)
    ) {
      this.fail(401, 'Vault token is invalid or expired.');
    }
    if (expectedPurpose !== undefined && purpose! !== expectedPurpose) {
      this.fail(403, 'Vault token is not valid for this operation.');
    }
    return {
      tenantId: tenantId!,
      documentId: documentId!,
      purpose: purpose!,
      jti: jti as string,
      iat: iat as number,
      exp: exp as number,
    };
  }

  private sign(payload: string): string {
    return crypto
      .createHmac('sha256', this.getSecret())
      .update(payload)
      .digest('base64url');
  }

  private getSecret(): string {
    const secret = process.env['VAULT_TOKEN_SECRET']?.trim();
    if (!secret || secret.length < 32) {
      throw new RpcException({
        statusCode: 503,
        message: 'Vault token verification is not configured.',
      });
    }
    return secret;
  }

  private requireTenantId(value: unknown, status: RpcStatus): string {
    if (typeof value !== 'string' || !value.trim()) {
      this.fail(status, 'Vault token is invalid.');
    }
    try {
      return sanitizeTenantId(value);
    } catch {
      this.fail(status, 'Vault token is invalid.');
    }
  }

  private requireDocumentId(value: unknown, status: RpcStatus): string {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      (value as string).length > 255 ||
      this.hasControlCharacter(value as string)
    ) {
      this.fail(
        status,
        status === 400
          ? 'A valid vault document id is required.'
          : 'Vault token is invalid.'
      );
    }
    return (value as string).trim();
  }

  private requirePurpose(value: unknown, status: RpcStatus): VaultTokenPurpose {
    if (
      value !== VAULT_TOKEN_PURPOSES.DOCUMENT_DROP &&
      value !== VAULT_TOKEN_PURPOSES.ESCROW_WIRE
    ) {
      this.fail(
        status,
        status === 400
          ? 'A valid vault token purpose is required.'
          : 'Vault token is invalid.'
      );
    }
    return value as VaultTokenPurpose;
  }

  private hasControlCharacter(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code < 32 || code === 127) {
        return true;
      }
    }
    return false;
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return (
      leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private fail(status: RpcStatus, message: string): never {
    throw new RpcException({ statusCode: status, message });
  }
}
