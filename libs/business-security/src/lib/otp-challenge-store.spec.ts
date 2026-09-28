import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  InMemoryOtpChallengeStore,
  TimeLockedOtpService,
  TwilioOtpSmsDispatcher,
  TypeOrmOtpChallengeStore,
} from '../index';

type CapturedMessage = { to: string; code: string };

class CapturingDispatcher {
  readonly messages: CapturedMessage[] = [];

  async dispatchOtp(message: CapturedMessage): Promise<{ messageId: string }> {
    this.messages.push(message);
    return { messageId: `message-${this.messages.length}` };
  }
}

type SharedChallengeRow = {
  id: string;
  tenantId: string;
  tokenId: string;
  purpose: string;
  stateType: string;
  codeHash: string | null;
  codeSalt: string | null;
  expiresAt: Date;
  attemptCount: number;
  consumedAt: Date | null;
};

function matchesStoredValue(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object' && 'type' in expected) {
    const operator = expected as { type: string; value?: unknown };
    if (operator.type === 'moreThan')
      return (actual as Date) > (operator.value as Date);
    if (operator.type === 'isNull') return actual === null;
  }
  return actual === expected;
}

class SharedTypeOrmRepository {
  readonly rows: SharedChallengeRow[] = [];

  create(value: Partial<SharedChallengeRow>): SharedChallengeRow {
    return {
      id: `row-${this.rows.length + 1}`,
      stateType: 'session',
      codeHash: null,
      codeSalt: null,
      attemptCount: 0,
      consumedAt: null,
      ...value,
    } as SharedChallengeRow;
  }

  async findOne(options: {
    where: Partial<SharedChallengeRow>;
  }): Promise<SharedChallengeRow | null> {
    return (
      this.rows.find((row) =>
        Object.entries(options.where).every(([key, expected]) =>
          matchesStoredValue(row[key as keyof SharedChallengeRow], expected)
        )
      ) || null
    );
  }

  async save(row: SharedChallengeRow): Promise<SharedChallengeRow> {
    const index = this.rows.findIndex((candidate) => candidate.id === row.id);
    if (index < 0) this.rows.push(row);
    else this.rows[index] = row;
    return row;
  }
}

function createSharedTypeOrmDataSource(repository: SharedTypeOrmRepository) {
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

describe('persistent OTP challenge contracts', () => {
  const originalTwilioAccountSid = process.env['TWILIO_ACCOUNT_SID'];
  const originalTwilioAuthToken = process.env['TWILIO_AUTH_TOKEN'];
  const originalTwilioPhoneNumber = process.env['TWILIO_PHONE_NUMBER'];

  afterEach(() => {
    if (originalTwilioAccountSid === undefined) {
      delete process.env['TWILIO_ACCOUNT_SID'];
    } else {
      process.env['TWILIO_ACCOUNT_SID'] = originalTwilioAccountSid;
    }
    if (originalTwilioAuthToken === undefined) {
      delete process.env['TWILIO_AUTH_TOKEN'];
    } else {
      process.env['TWILIO_AUTH_TOKEN'] = originalTwilioAuthToken;
    }
    if (originalTwilioPhoneNumber === undefined) {
      delete process.env['TWILIO_PHONE_NUMBER'];
    } else {
      process.env['TWILIO_PHONE_NUMBER'] = originalTwilioPhoneNumber;
    }
  });

  it('stores a salted code hash and never returns the code from issuance', async () => {
    const store = new InMemoryOtpChallengeStore();
    const dispatcher = new CapturingDispatcher();
    const service = new TimeLockedOtpService(
      store,
      dispatcher,
      () => 1700000000000
    );

    const issued = await service.generateOtp({
      tokenId: 'session-token',
      tenantId: 'tenant-a',
      purpose: 'escrow-sms',
      phoneNumber: '+15555550100',
    });

    expect(issued).not.toHaveProperty('code');
    expect(dispatcher.messages).toHaveLength(1);
    const stored = await store.getChallenge(
      'tenant-a',
      'session-token',
      'escrow-sms',
      new Date(1700000000000)
    );
    expect(stored?.codeHash).not.toBe(dispatcher.messages[0].code);
    expect(stored?.codeSalt).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.stringify(stored)).not.toContain(dispatcher.messages[0].code);
    expect(
      await service.verifyOtp(
        'session-token',
        dispatcher.messages[0].code,
        undefined,
        30,
        { tenantId: 'tenant-a', purpose: 'escrow-sms' }
      )
    ).toBe(true);
  });

  it('persists a challenge through separate TypeOrm store instances', async () => {
    const repository = new SharedTypeOrmRepository();
    const dataSource = createSharedTypeOrmDataSource(repository);
    const firstStore = new TypeOrmOtpChallengeStore(dataSource);
    const secondStore = new TypeOrmOtpChallengeStore(dataSource);
    const challenge = {
      tokenId: 'persistent-token',
      tenantId: 'tenant-a',
      purpose: 'escrow-sms',
      codeHash: 'a'.repeat(64),
      codeSalt: 'b'.repeat(32),
      expiresAt: new Date(1700000090000),
      attemptCount: 0,
      consumedAt: null,
    };

    await firstStore.storeChallenge(challenge);

    await expect(
      secondStore.getChallenge(
        'tenant-a',
        'persistent-token',
        'escrow-sms',
        new Date(1700000000000)
      )
    ).resolves.toEqual(
      expect.objectContaining({
        tokenId: challenge.tokenId,
        codeHash: challenge.codeHash,
        codeSalt: challenge.codeSalt,
      })
    );
  });

  it('rejects issuance when the real Twilio dispatcher is not configured', async () => {
    delete process.env['TWILIO_ACCOUNT_SID'];
    delete process.env['TWILIO_AUTH_TOKEN'];
    delete process.env['TWILIO_PHONE_NUMBER'];
    const dispatcher = new TwilioOtpSmsDispatcher({
      get: () => undefined,
    } as never);
    const store = new InMemoryOtpChallengeStore();
    const service = new TimeLockedOtpService(store, dispatcher);

    await expect(
      service.generateOtp({
        tokenId: 'unconfigured-token',
        tenantId: 'tenant-a',
        purpose: 'escrow-sms',
        phoneNumber: '+15555550100',
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(
      await store.getChallenge('tenant-a', 'unconfigured-token', 'escrow-sms')
    ).toBeNull();
  });

  it('calls the real Twilio Messages endpoint and returns only its message id', async () => {
    process.env['TWILIO_ACCOUNT_SID'] = 'AC123';
    process.env['TWILIO_AUTH_TOKEN'] = 'token';
    process.env['TWILIO_PHONE_NUMBER'] = '+15555550100';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'SM123' }),
    } as Response);
    const dispatcher = new TwilioOtpSmsDispatcher({
      get: () => undefined,
    } as never);

    await expect(
      dispatcher.dispatchOtp({
        to: '+15555550100',
        code: '123456',
        tenantId: 'tenant-a',
        purpose: 'escrow-sms',
      })
    ).resolves.toEqual({ messageId: 'SM123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json',
      expect.objectContaining({ method: 'POST' })
    );
    fetchMock.mockRestore();
  });

  it('requires tenant context before consulting a persistent store', async () => {
    const service = new TimeLockedOtpService(
      new TypeOrmOtpChallengeStore({} as never),
      new CapturingDispatcher()
    );

    await expect(service.verifyOtp('token', '123456')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('rejects replay after a service restart when the store is shared', async () => {
    let now = 1700000000000;
    const store = new InMemoryOtpChallengeStore();
    const dispatcher = new CapturingDispatcher();
    const firstService = new TimeLockedOtpService(store, dispatcher, () => now);
    const secondService = new TimeLockedOtpService(
      store,
      dispatcher,
      () => now
    );
    const secret = 'persistent-totp-secret';
    const code = firstService.generateRollingTotp(secret);

    expect(
      await firstService.verifyRollingTotp(secret, code, 30, 'wire-token', {
        tenantId: 'tenant-a',
        purpose: 'escrow-wire',
      })
    ).toBe(true);
    expect(
      await secondService.verifyRollingTotp(secret, code, 30, 'wire-token', {
        tenantId: 'tenant-a',
        purpose: 'escrow-wire',
      })
    ).toBe(false);
  });
});
