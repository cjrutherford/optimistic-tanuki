import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { VaultEscrowService } from './vault-escrow.service';
import { VaultEscrowEntity } from '../../entities/vault-escrow.entity';
import {
  InMemoryOtpChallengeStore,
  TimeLockedOtpService,
} from '@optimistic-tanuki/business-security';
import { VAULT_APPEND_AUDIT_EVENT } from '@optimistic-tanuki/constants';

class TestRepository {
  readonly records: VaultEscrowEntity[] = [];

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
    query: async () => [],
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
  readonly messages: string[] = [];

  async dispatchOtp(message: { code: string }) {
    this.messages.push(message.code);
    return { messageId: `sms-${this.messages.length}` };
  }
}

describe('VaultEscrowService', () => {
  let service: VaultEscrowService;
  let otpService: TimeLockedOtpService;
  let otpStore: InMemoryOtpChallengeStore;
  let smsDispatcher: CapturingDispatcher;
  let complianceAuditClient: { send: jest.Mock };
  let repository: TestRepository;
  let dataSource: ReturnType<typeof createDataSource>;

  const originalEncryptionSecret = process.env['VAULT_ENCRYPTION_SECRET'];
  const testTotpSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const testEscrow = {
    token: 'escrow-test-token',
    tenantId: 'tenant-test',
    beneficiary: 'Verified Test Escrow Trust',
    bankName: 'Test Bank',
    routingNumber: '000000000',
    accountNumber: '0000000000',
    reference: 'ESCROW-TEST-REFERENCE',
    totpSecret: testTotpSecret,
  };

  const currentAuthenticatorCode = (): string =>
    otpService.rfc6238TotpForCounter(
      testTotpSecret,
      Math.floor(Date.now() / 1000 / 30)
    );

  const appendedRecords = (): Array<Record<string, unknown>> =>
    complianceAuditClient.send.mock.calls.map((call) => call[1]);

  beforeEach(() => {
    process.env['VAULT_ENCRYPTION_SECRET'] =
      'test-vault-encryption-secret-with-sufficient-entropy';
    repository = new TestRepository();
    dataSource = createDataSource(repository);
    otpStore = new InMemoryOtpChallengeStore();
    smsDispatcher = new CapturingDispatcher();
    otpService = new TimeLockedOtpService(otpStore, smsDispatcher);
    complianceAuditClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'audit-record-1',
          tenantId: testEscrow.tenantId,
          action: 'ESCROW_WIRE_REVEALED',
          documentId: testEscrow.token,
          fileName: 'Escrow-Wire-ESCROW-TEST-REFERENCE.json',
          documentHash: 'a'.repeat(64),
          previousHash: '0'.repeat(64),
          chainedHash: 'b'.repeat(64),
          antivirusStatus: 'not_scanned',
          complianceStandard:
            'ALTA Pillar 3 Wire Fraud Defense, FTC 16 CFR Part 314',
          metadata: {},
          timestamp: '2026-09-25T12:00:00.000Z',
        })
      ),
    };
    service = new VaultEscrowService(
      otpService,
      complianceAuditClient as never,
      dataSource
    );
  });

  afterEach(() => {
    if (originalEncryptionSecret === undefined) {
      delete process.env['VAULT_ENCRYPTION_SECRET'];
    } else {
      process.env['VAULT_ENCRYPTION_SECRET'] = originalEncryptionSecret;
    }
  });

  const registerTestEscrow = async (): Promise<void> => {
    await service.registerEscrowRecord(testEscrow);
  };

  it('returns an authenticator enrollment URI at registration', async () => {
    const enrolled = await service.registerEscrowRecord(testEscrow);

    expect(enrolled.token).toBe(testEscrow.token);
    expect(enrolled.enrollmentUri).toMatch(
      /^otpauth:\/\/totp\/.+\?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=.+&algorithm=SHA1&digits=6&period=30$/
    );
    expect(enrolled.enrollmentExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not expose a live-code issuance backdoor', () => {
    expect(
      (service as unknown as Record<string, unknown>)['generateWireOtp']
    ).toBeUndefined();
  });

  it('verifies a newly issued TOTP and reveals encrypted wire instructions', async () => {
    await registerTestEscrow();
    const code = currentAuthenticatorCode();

    const result = await service.verifyAndRevealWire({
      token: testEscrow.token,
      otpCode: code,
      tenantId: testEscrow.tenantId,
    });

    expect(result.escrowId).toBe(testEscrow.token);
    expect(result.beneficiary).toBe(testEscrow.beneficiary);
    expect(result.accountNumber).toBe(testEscrow.accountNumber);
    expect(result.routingNumber).toBe(testEscrow.routingNumber);
    expect(result.complianceNotice).toContain('ALTA Pillar 3');
  });

  it('appends the wire reveal to the compliance-audit ledger over TCP', async () => {
    await registerTestEscrow();
    const code = currentAuthenticatorCode();

    await service.verifyAndRevealWire({
      token: testEscrow.token,
      otpCode: code,
      tenantId: testEscrow.tenantId,
    });

    expect(complianceAuditClient.send).toHaveBeenCalledWith(
      VAULT_APPEND_AUDIT_EVENT,
      expect.objectContaining({
        tenantId: testEscrow.tenantId,
        action: 'ESCROW_WIRE_REVEALED',
        documentId: testEscrow.token,
        fileName: 'Escrow-Wire-ESCROW-TEST-REFERENCE.json',
      })
    );
    const [payload] = appendedRecords() as Array<{ documentHash: string }>;
    expect(payload.documentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never lets a caller supply the chain hashes', async () => {
    await registerTestEscrow();
    const code = currentAuthenticatorCode();

    await service.verifyAndRevealWire({
      token: testEscrow.token,
      otpCode: code,
      tenantId: testEscrow.tenantId,
    });

    const [payload] = appendedRecords() as Array<Record<string, unknown>>;
    expect(payload).not.toHaveProperty('previousHash');
    expect(payload).not.toHaveProperty('chainedHash');
  });

  it('withholds the wire instructions when the audit ledger is unreachable', async () => {
    await registerTestEscrow();
    const code = currentAuthenticatorCode();
    complianceAuditClient.send.mockReturnValue(
      throwError(() => new Error('connect ECONNREFUSED 127.0.0.1:3025'))
    );

    await expect(
      service.verifyAndRevealWire({
        token: testEscrow.token,
        otpCode: code,
        tenantId: testEscrow.tenantId,
      })
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects an incorrect code after issuing the rolling TOTP', async () => {
    await registerTestEscrow();
    const code = currentAuthenticatorCode();
    const wrongCode = code === '000000' ? '999999' : '000000';

    await expect(
      service.verifyAndRevealWire({
        token: testEscrow.token,
        otpCode: wrongCode,
        tenantId: testEscrow.tenantId,
      })
    ).rejects.toThrow(UnauthorizedException);
    const actions = appendedRecords().map((record) => record['action']);
    expect(actions).not.toContain('ESCROW_WIRE_REVEALED');
  });

  it.each(['escrow-closing-8821', 'demo-escrow-token'])(
    'does not seed the retired escrow token %s',
    async (token) => {
      await expect(
        service.verifyAndRevealWire({
          token,
          otpCode: '000000',
          tenantId: testEscrow.tenantId,
        })
      ).rejects.toThrow(ForbiddenException);
    }
  );

  it('rejects cross-tenant escrow reads', async () => {
    await registerTestEscrow();
    await expect(
      service.verifyAndRevealWire({
        token: testEscrow.token,
        otpCode: '000000',
        tenantId: 'tenant-other',
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires VAULT_ENCRYPTION_SECRET when registering an escrow', async () => {
    delete process.env['VAULT_ENCRYPTION_SECRET'];
    await expect(service.registerEscrowRecord(testEscrow)).rejects.toThrow(
      'VAULT_ENCRYPTION_SECRET is required'
    );
  });

  it('requires VAULT_ENCRYPTION_SECRET when revealing an escrow', async () => {
    await registerTestEscrow();
    const code = currentAuthenticatorCode();
    delete process.env['VAULT_ENCRYPTION_SECRET'];

    await expect(
      service.verifyAndRevealWire({
        token: testEscrow.token,
        otpCode: code,
        tenantId: testEscrow.tenantId,
      })
    ).rejects.toThrow('VAULT_ENCRYPTION_SECRET is required');
  });

  it('reveals wire instructions with a one-time SMS code', async () => {
    await registerTestEscrow();
    const issued = await service.requestWireSmsOtp({
      token: testEscrow.token,
      tenantId: testEscrow.tenantId,
      phoneNumber: '+19125550100',
    });

    expect(issued.messageId).toMatch(/^sms-/);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const smsCode = smsDispatcher.messages[smsDispatcher.messages.length - 1];
    expect(smsCode).toMatch(/^\d{6}$/);

    const result = await service.verifyAndRevealWire({
      token: testEscrow.token,
      otpCode: smsCode,
      tenantId: testEscrow.tenantId,
    });
    expect(result.escrowId).toBe(testEscrow.token);
    expect(result.routingNumber).toBe(testEscrow.routingNumber);
  });

  it('refuses SMS codes for unknown or closed escrows', async () => {
    await expect(
      service.requestWireSmsOtp({
        token: 'no-such-escrow',
        tenantId: testEscrow.tenantId,
        phoneNumber: '+19125550100',
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('reports Twilio as unconfigured when credentials are absent', async () => {
    delete process.env['TWILIO_ACCOUNT_SID'];
    delete process.env['TWILIO_AUTH_TOKEN'];

    await expect(service.verifyTwilioProvider()).rejects.toThrow(
      ServiceUnavailableException
    );
  });

  it('verifies live Twilio credentials against the Twilio API', async () => {
    process.env['TWILIO_ACCOUNT_SID'] = 'AC123';
    process.env['TWILIO_AUTH_TOKEN'] = 'token';
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const status = await service.verifyTwilioProvider();

      expect(status).toEqual({
        configured: true,
        verified: true,
        accountSid: 'AC123',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC123.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    } finally {
      global.fetch = originalFetch;
      delete process.env['TWILIO_ACCOUNT_SID'];
      delete process.env['TWILIO_AUTH_TOKEN'];
    }
  });
});
