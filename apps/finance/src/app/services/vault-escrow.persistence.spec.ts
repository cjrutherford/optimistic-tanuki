import { randomUUID } from 'crypto';
import { of } from 'rxjs';
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  InMemoryOtpChallengeStore,
  TimeLockedOtpService,
} from '@optimistic-tanuki/business-security';
import { VAULT_APPEND_AUDIT_EVENT } from '@optimistic-tanuki/constants';
import { VaultEscrowService } from './vault-escrow.service';
import { VaultEscrowEntity } from '../../entities/vault-escrow.entity';

class TestRepository {
  readonly records: VaultEscrowEntity[] = [];
  tenantId = '';

  create(value: Partial<VaultEscrowEntity>): VaultEscrowEntity {
    return {
      id: randomUUID(),
      active: true,
      ...value,
    } as VaultEscrowEntity;
  }

  async findOne(options: {
    where: Partial<VaultEscrowEntity>;
  }): Promise<VaultEscrowEntity | null> {
    return (
      this.records.find((record) =>
        Object.entries(options.where).every(
          ([key, value]) => record[key as keyof VaultEscrowEntity] === value
        )
      ) || null
    );
  }

  async save(entity: VaultEscrowEntity): Promise<VaultEscrowEntity> {
    const index = this.records.findIndex((record) => record.id === entity.id);
    if (index < 0) this.records.push(entity);
    else this.records[index] = entity;
    return entity;
  }
}

function createDataSource(repository: TestRepository) {
  const queryRunner = {
    isTransactionActive: true,
    query: async (_statement: string, parameters?: unknown[]) => {
      repository.tenantId = String(parameters?.[0] || '');
      return [];
    },
  };
  const manager = {
    queryRunner,
    getRepository: () => repository,
  };
  return {
    transaction: async <T>(callback: (value: typeof manager) => Promise<T>) =>
      callback(manager),
  } as never;
}

class CapturingDispatcher {
  async dispatchOtp(message: { to: string; code: string }) {
    return { messageId: `sms-${message.code}` };
  }
}

describe('VaultEscrowService persistence contracts', () => {
  const originalSecret = process.env['VAULT_ENCRYPTION_SECRET'];
  const repository = new TestRepository();
  const otpStore = new InMemoryOtpChallengeStore();
  const dispatcher = new CapturingDispatcher();
  const complianceAuditClient = {
    send: jest.fn().mockReturnValue(of({ id: 'audit-1' })),
  };
  const dataSource = createDataSource(repository);
  const persistentTotpSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  let service: VaultEscrowService;
  let otpService: TimeLockedOtpService;

  const currentCode = (): string =>
    otpService.rfc6238TotpForCounter(
      persistentTotpSecret,
      Math.floor(Date.now() / 1000 / 30)
    );

  beforeEach(() => {
    process.env['VAULT_ENCRYPTION_SECRET'] = 'test-vault-encryption-secret';
    complianceAuditClient.send.mockClear();
    otpService = new TimeLockedOtpService(otpStore, dispatcher);
    service = new VaultEscrowService(
      otpService,
      complianceAuditClient as never,
      dataSource
    );
  });

  afterAll(() => {
    if (originalSecret === undefined)
      delete process.env['VAULT_ENCRYPTION_SECRET'];
    else process.env['VAULT_ENCRYPTION_SECRET'] = originalSecret;
  });

  it('persists routing and account numbers only as ciphertext with IV and auth tags', async () => {
    await service.registerEscrowRecord({
      token: 'persistent-escrow',
      tenantId: 'tenant-a',
      beneficiary: 'Beneficiary',
      bankName: 'Bank',
      routingNumber: '061000104',
      accountNumber: '123456789',
      reference: 'REFERENCE-1',
    });

    const record = repository.records[0];
    expect(record.encryptedRoutingNumber).not.toBe('061000104');
    expect(record.encryptedAccountNumber).not.toBe('123456789');
    expect(Object.prototype.hasOwnProperty.call(record, 'routingNumber')).toBe(
      false
    );
    expect(Object.prototype.hasOwnProperty.call(record, 'accountNumber')).toBe(
      false
    );
    expect(record.routingNumberIv).toMatch(/^[a-f0-9]{24}$/);
    expect(record.accountNumberIv).toMatch(/^[a-f0-9]{24}$/);
    expect(record.routingNumberAuthTag).toMatch(/^[a-f0-9]{32}$/);
    expect(record.accountNumberAuthTag).toMatch(/^[a-f0-9]{32}$/);
  });

  it('reveals only after rolling TOTP verification and rejects cross-tenant reads', async () => {
    await service.registerEscrowRecord({
      token: 'persistent-escrow',
      tenantId: 'tenant-a',
      beneficiary: 'Beneficiary',
      bankName: 'Bank',
      routingNumber: '061000104',
      accountNumber: '123456789',
      reference: 'REFERENCE-1',
      totpSecret: persistentTotpSecret,
    });
    const result = await service.verifyAndRevealWire({
      token: 'persistent-escrow',
      otpCode: currentCode(),
      tenantId: 'tenant-a',
    });

    expect(result.routingNumber).toBe('061000104');
    expect(result.accountNumber).toBe('123456789');
    expect(complianceAuditClient.send).toHaveBeenCalledWith(
      VAULT_APPEND_AUDIT_EVENT,
      expect.objectContaining({ tenantId: 'tenant-a' })
    );

    await expect(
      service.verifyAndRevealWire({
        token: 'persistent-escrow',
        otpCode: '654321',
        tenantId: 'tenant-b',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('retains a rolling TOTP replay denial after service reconstruction', async () => {
    await service.registerEscrowRecord({
      token: 'replay-escrow',
      tenantId: 'tenant-a',
      beneficiary: 'Beneficiary',
      bankName: 'Bank',
      routingNumber: '061000104',
      accountNumber: '123456789',
      reference: 'REFERENCE-2',
      totpSecret: persistentTotpSecret,
    });
    const code = currentCode();
    await service.verifyAndRevealWire({
      token: 'replay-escrow',
      otpCode: code,
      tenantId: 'tenant-a',
    });
    const reconstructed = new VaultEscrowService(
      new TimeLockedOtpService(otpStore, dispatcher),
      complianceAuditClient as never,
      dataSource
    );

    await expect(
      reconstructed.verifyAndRevealWire({
        token: 'replay-escrow',
        otpCode: code,
        tenantId: 'tenant-a',
      })
    ).rejects.toThrow();
  });

  it('fails closed when encryption is not configured', async () => {
    delete process.env['VAULT_ENCRYPTION_SECRET'];
    await expect(
      service.registerEscrowRecord({
        token: 'unencrypted-escrow',
        tenantId: 'tenant-a',
        beneficiary: 'Beneficiary',
        bankName: 'Bank',
        routingNumber: '061000104',
        accountNumber: '123456789',
        reference: 'REFERENCE-3',
      })
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
