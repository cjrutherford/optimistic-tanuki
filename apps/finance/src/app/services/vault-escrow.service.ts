import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import {
  ComplianceAuditAppendInput,
  ComplianceAuditLogRecord,
  WireInstructionResponseDto,
  WireVerificationRequestDto,
} from '@optimistic-tanuki/models';
import {
  ServiceTokens,
  VAULT_APPEND_AUDIT_EVENT,
} from '@optimistic-tanuki/constants';
import {
  OtpIssueResult,
  sanitizeTenantId,
  TimeLockedOtpService,
  withTenantRlsTransaction,
} from '@optimistic-tanuki/business-security';
import { DataSource, EntityManager } from 'typeorm';
import { VaultEscrowEntity } from '../../entities/vault-escrow.entity';

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

@Injectable()
export class VaultEscrowService {
  private readonly logger = new Logger(VaultEscrowService.name);

  constructor(
    private readonly otpService: TimeLockedOtpService,
    @Inject(ServiceTokens.COMPLIANCE_AUDIT_SERVICE)
    private readonly complianceAuditClient: ClientProxy,
    @Inject('FINANCE_CONNECTION')
    private readonly dataSource: DataSource
  ) {}

  async registerEscrowRecord(params: {
    token: string;
    tenantId: string;
    beneficiary: string;
    bankName: string;
    routingNumber: string;
    accountNumber: string;
    reference: string;
    totpSecret?: string;
  }): Promise<{
    token: string;
    enrollmentUri: string;
    enrollmentExpiresAt: Date;
  }> {
    const tenantId = this.requireTenantId(params.tenantId);
    const token = this.requireToken(params.token);
    this.requireText(params.beneficiary, 'A beneficiary name is required.');
    this.requireText(params.bankName, 'A bank name is required.');
    this.requireText(params.routingNumber, 'A routing number is required.');
    this.requireText(params.accountNumber, 'An account number is required.');
    this.requireText(params.reference, 'An escrow reference is required.');
    const encryptionKey = this.getEncryptionKey();
    const routing = this.encrypt(params.routingNumber, encryptionKey);
    const account = this.encrypt(params.accountNumber, encryptionKey);
    const providedSecret = params.totpSecret?.trim();
    if (
      providedSecret &&
      !/^[A-Z2-7]{16,64}$/i.test(providedSecret.replace(/=+$/, ''))
    ) {
      throw new BadRequestException('A provided TOTP secret must be base32.');
    }
    const totpSecret =
      providedSecret?.toUpperCase().replace(/=+$/, '') ||
      this.otpService.generateRfc6238Secret();
    const encryptedTotpSecret = this.encrypt(totpSecret, encryptionKey);

    await withTenantRlsTransaction(
      this.dataSource,
      tenantId,
      async (manager) => {
        const repository = (manager as unknown as EntityManager).getRepository(
          VaultEscrowEntity
        );
        const existing = await repository.findOne({
          where: { tenantId, token: params.token },
        });
        const entity = repository.create({
          ...(existing ? { id: existing.id } : {}),
          token: params.token,
          tenantId,
          beneficiary: params.beneficiary,
          bankName: params.bankName,
          encryptedRoutingNumber: routing.ciphertext,
          routingNumberIv: routing.iv,
          routingNumberAuthTag: routing.authTag,
          encryptedAccountNumber: account.ciphertext,
          accountNumberIv: account.iv,
          accountNumberAuthTag: account.authTag,
          encryptedTotpSecret: encryptedTotpSecret.ciphertext,
          totpSecretIv: encryptedTotpSecret.iv,
          totpSecretAuthTag: encryptedTotpSecret.authTag,
          reference: params.reference,
          active: true,
        });
        await repository.save(entity);
      }
    );

    await this.appendAuditEvent({
      tenantId,
      action: 'ESCROW_REGISTERED',
      documentId: token,
      fileName: `Escrow-Wire-${params.reference}.json`,
      documentHash: crypto
        .createHash('sha256')
        .update(`${token}:${params.reference}:${tenantId}`)
        .digest('hex'),
      complianceStandard:
        'ALTA Pillar 3 Wire Fraud Defense, FTC 16 CFR Part 314',
    });

    const issuer = encodeURIComponent('Practice Vault Escrow Wire Shield');
    const accountLabel = encodeURIComponent(`${params.reference} (${token})`);
    return {
      token,
      enrollmentUri: `otpauth://totp/${issuer}:${accountLabel}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
      enrollmentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async requestWireSmsOtp(params: {
    token: string;
    tenantId: string;
    phoneNumber: string;
    validitySeconds?: number;
  }): Promise<OtpIssueResult> {
    const tenantId = this.requireTenantId(params.tenantId);
    const token = this.requireToken(params.token);
    const escrow = await this.findEscrow(token, tenantId);
    if (!escrow || !escrow.active) {
      throw new ForbiddenException(
        'Escrow wire transaction not found or closed.'
      );
    }
    return this.generateWireSmsOtp({
      token,
      tenantId,
      phoneNumber: params.phoneNumber,
      validitySeconds: params.validitySeconds,
    });
  }

  async generateWireSmsOtp(params: {
    token: string;
    tenantId: string;
    phoneNumber: string;
    validitySeconds?: number;
  }): Promise<OtpIssueResult> {
    return this.otpService.generateOtp({
      tokenId: params.token,
      tenantId: this.requireTenantId(params.tenantId),
      purpose: 'escrow-wire',
      phoneNumber: params.phoneNumber,
      validitySeconds: params.validitySeconds ?? 90,
    });
  }

  async verifyTwilioProvider(): Promise<{
    configured: boolean;
    verified: boolean;
    accountSid: string | null;
  }> {
    const accountSid = process.env['TWILIO_ACCOUNT_SID']?.trim();
    const authToken = process.env['TWILIO_AUTH_TOKEN']?.trim();
    if (!accountSid || !authToken) {
      throw new ServiceUnavailableException('Twilio SMS is not configured.');
    }
    let response: Response;
    try {
      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${accountSid}:${authToken}`
            ).toString('base64')}`,
          },
        }
      );
    } catch {
      throw new ServiceUnavailableException(
        'Twilio account verification is unreachable.'
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Twilio credentials were rejected by Twilio.'
      );
    }
    return { configured: true, verified: true, accountSid };
  }

  async verifyAndRevealWire(
    dto: WireVerificationRequestDto
  ): Promise<WireInstructionResponseDto> {
    const tenantId = this.requireTenantId(dto.tenantId);
    const escrow = await this.findEscrow(dto.token, tenantId);
    if (!escrow || !escrow.active) {
      throw new ForbiddenException(
        'Escrow wire transaction not found or closed.'
      );
    }

    const encryptionKey = this.getEncryptionKey();
    const totpSecret = this.decrypt(
      escrow.encryptedTotpSecret,
      escrow.totpSecretIv,
      escrow.totpSecretAuthTag
    );
    const smsAccepted = await this.otpService.verifyOtp(
      dto.token,
      dto.otpCode,
      undefined,
      30,
      { tenantId, purpose: 'escrow-wire' }
    );
    const authenticatorAccepted =
      !smsAccepted &&
      (await this.otpService.verifyRfc6238Totp(
        totpSecret,
        dto.otpCode,
        dto.token,
        { tenantId, purpose: 'escrow-wire' }
      ));
    if (!smsAccepted && !authenticatorAccepted) {
      this.logger.warn(
        `Failed wire verification attempt for token ${dto.token}`
      );
      throw new UnauthorizedException(
        'Invalid or expired 6-digit rolling TOTP code. Access to wire instructions denied.'
      );
    }

    const routingNumber = this.decrypt(
      escrow.encryptedRoutingNumber,
      escrow.routingNumberIv,
      escrow.routingNumberAuthTag,
      encryptionKey
    );
    const accountNumber = this.decrypt(
      escrow.encryptedAccountNumber,
      escrow.accountNumberIv,
      escrow.accountNumberAuthTag,
      encryptionKey
    );
    const verifiedAt = new Date();
    const expiresAt = new Date(verifiedAt.getTime() + 10 * 60 * 1000);

    await this.appendAuditEvent({
      tenantId,
      action: 'ESCROW_WIRE_REVEALED',
      documentId: escrow.token,
      fileName: `Escrow-Wire-${escrow.reference}.json`,
      documentHash: crypto
        .createHash('sha256')
        .update(
          `${escrow.token}:${escrow.reference}:${verifiedAt.toISOString()}`
        )
        .digest('hex'),
      complianceStandard:
        'ALTA Pillar 3 Wire Fraud Defense, FTC 16 CFR Part 314',
    });

    this.logger.log(
      `Escrow wire decrypted successfully for token ${dto.token} under ALTA Pillar 3.`
    );

    return {
      escrowId: escrow.token,
      beneficiary: escrow.beneficiary,
      bankName: escrow.bankName,
      routingNumber,
      accountNumber,
      reference: escrow.reference,
      verifiedAt,
      expiresAt,
      complianceNotice:
        'Protected by ALTA Pillar 3 Wire Fraud Defense protocol. Confirm directly by telephone prior to transfer.',
    };
  }

  private async findEscrow(
    token: string,
    tenantId: string
  ): Promise<VaultEscrowEntity | null> {
    return withTenantRlsTransaction(
      this.dataSource,
      tenantId,
      async (manager) =>
        (manager as unknown as EntityManager)
          .getRepository(VaultEscrowEntity)
          .findOne({ where: { tenantId, token, active: true } })
    );
  }

  private getEncryptionKey(): Buffer {
    const secret = process.env['VAULT_ENCRYPTION_SECRET'];
    if (!secret || !secret.trim()) {
      throw new ServiceUnavailableException(
        'VAULT_ENCRYPTION_SECRET is required for vault escrow encryption.'
      );
    }
    return crypto.createHash('sha256').update(secret).digest();
  }

  private encrypt(value: string, key: Buffer): EncryptedValue {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(value, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
    };
  }

  private decrypt(
    ciphertext: string,
    iv: string,
    authTag: string,
    key = this.getEncryptionKey()
  ): string {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      return plaintext;
    } catch {
      throw new ServiceUnavailableException(
        'Vault escrow bank details could not be authenticated.'
      );
    }
  }

  private requireTenantId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(
        'Tenant context is required for escrow access.'
      );
    }
    try {
      return sanitizeTenantId(value);
    } catch {
      throw new BadRequestException(
        'Tenant context is invalid for escrow access.'
      );
    }
  }

  private requireToken(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 255) {
      throw new BadRequestException('A valid escrow token is required.');
    }
    return value.trim();
  }

  private requireText(value: unknown, message: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private async appendAuditEvent(
    input: ComplianceAuditAppendInput
  ): Promise<ComplianceAuditLogRecord> {
    try {
      return await firstValueFrom(
        this.complianceAuditClient.send<ComplianceAuditLogRecord>(
          VAULT_APPEND_AUDIT_EVENT,
          input
        )
      );
    } catch (error) {
      this.logger.error(
        `Compliance audit ledger append failed for escrow ${
          input.documentId
        }: ${
          error instanceof Error ? error.message : 'unknown transport error'
        }`
      );
      throw new ServiceUnavailableException(
        'The compliance audit ledger is unavailable; wire instructions are withheld.'
      );
    }
  }
}
