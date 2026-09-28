import { RpcException } from '@nestjs/microservices';
import { VaultTokenEntity } from '../../entities/vault-token.entity';
import { VAULT_TOKEN_PURPOSES, VaultTokenService } from './vault-token.service';

class TestTokenRepository {
  readonly records: VaultTokenEntity[] = [];
  lastFindOptions: unknown = null;

  async insert(
    value: Partial<VaultTokenEntity>
  ): Promise<{ identifiers: Array<{ id: string }> }> {
    const record = {
      id: `token-${this.records.length + 1}`,
      consumedAt: null,
      revokedAt: null,
      issuedBy: null,
      createdAt: new Date(),
      ...value,
    } as VaultTokenEntity;
    this.records.push(record);
    return { identifiers: [{ id: record.id }] };
  }

  async findOne(options: {
    where: Partial<VaultTokenEntity>;
  }): Promise<VaultTokenEntity | null> {
    this.lastFindOptions = options;
    return (
      this.records.find((record) =>
        Object.entries(options.where).every(
          ([key, value]) => record[key as keyof VaultTokenEntity] === value
        )
      ) || null
    );
  }

  async save(entity: VaultTokenEntity): Promise<VaultTokenEntity> {
    const index = this.records.findIndex((record) => record.id === entity.id);
    if (index < 0) this.records.push(entity);
    else this.records[index] = entity;
    return entity;
  }
}

function createDataSource(repository: TestTokenRepository) {
  const manager = {
    queryRunner: { isTransactionActive: true, query: async () => [] },
    getRepository: () => repository,
  };
  return {
    transaction: async <T>(callback: (value: typeof manager) => Promise<T>) =>
      callback(manager),
  } as never;
}

async function rpcError(promise: Promise<unknown>): Promise<{
  statusCode: number;
  message: string;
}> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError() as {
      statusCode: number;
      message: string;
    };
  }
  throw new Error('Expected the call to fail.');
}

describe('VaultTokenService', () => {
  const previousSecret = process.env['VAULT_TOKEN_SECRET'];
  let service: VaultTokenService;
  let repository: TestTokenRepository;

  beforeEach(() => {
    process.env['VAULT_TOKEN_SECRET'] =
      'unit-test-vault-token-secret-0123456789';
    repository = new TestTokenRepository();
    service = new VaultTokenService(createDataSource(repository));
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env['VAULT_TOKEN_SECRET'];
    } else {
      process.env['VAULT_TOKEN_SECRET'] = previousSecret;
    }
  });

  const issueDrop = (overrides: Record<string, unknown> = {}) =>
    service.issue({
      tenantId: 'wirepro-cpa',
      documentId: 'drop-1',
      purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      ...overrides,
    });

  it('issues a signed token and persists its state', async () => {
    const token = await issueDrop();

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(2);
    expect(token).not.toContain('wirepro-cpa');
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]).toEqual(
      expect.objectContaining({
        tenantId: 'wirepro-cpa',
        documentId: 'drop-1',
        purpose: 'document-drop',
        consumedAt: null,
        revokedAt: null,
      })
    );
  });

  it('validates an issued token and returns its claims', async () => {
    const token = await issueDrop();

    const claims = await service.validate({
      token,
      purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      expectedTenantId: 'wirepro-cpa',
      expectedDocumentId: 'drop-1',
    });

    expect(claims).toEqual(
      expect.objectContaining({
        tenantId: 'wirepro-cpa',
        documentId: 'drop-1',
        purpose: 'document-drop',
      })
    );
  });

  it('consumes a token once and rejects the replay', async () => {
    const token = await issueDrop();
    await service.consume({
      token,
      purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
    });

    const replay = await rpcError(
      service.validate({
        token,
        purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      })
    );
    expect(replay.statusCode).toBe(401);
    expect(repository.records[0].consumedAt).toBeInstanceOf(Date);
  });

  it('locks the row when consuming', async () => {
    const token = await issueDrop();
    await service.consume({
      token,
      purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
    });

    expect(repository.lastFindOptions).toEqual(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } })
    );
  });

  it('rejects a revoked token with 403', async () => {
    const token = await issueDrop();
    await service.revoke(token);

    const result = await rpcError(
      service.validate({
        token,
        purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      })
    );
    expect(result.statusCode).toBe(403);
  });

  it('rejects tokens whose server-side state is unknown with 401', async () => {
    const token = await issueDrop();
    repository.records.length = 0;

    const result = await rpcError(
      service.validate({
        token,
        purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      })
    );
    expect(result.statusCode).toBe(401);
  });

  it('rejects tampered payloads and foreign signatures with 401', async () => {
    const token = await issueDrop();
    const [payload, signature] = token.split('.');
    const tampered = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );
    tampered.tenantId = 'other-tenant';
    const tamperedPayload = Buffer.from(JSON.stringify(tampered)).toString(
      'base64url'
    );

    const first = await rpcError(
      service.validate({
        token: `${tamperedPayload}.${signature}`,
        purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      })
    );
    expect(first.statusCode).toBe(401);

    const second = await rpcError(
      service.validate({
        token: 'not-a-token',
        purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      })
    );
    expect(second.statusCode).toBe(401);
  });

  it('rejects a token presented for the wrong operation with 403', async () => {
    const token = await issueDrop();

    const result = await rpcError(
      service.validate({
        token,
        purpose: VAULT_TOKEN_PURPOSES.ESCROW_WIRE,
      })
    );
    expect(result.statusCode).toBe(403);
  });

  it('rejects expired tokens with 401', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    try {
      const token = await issueDrop({ expiresInSeconds: 60 });
      jest.setSystemTime(new Date('2026-01-01T00:05:00.000Z'));

      const result = await rpcError(
        service.validate({
          token,
          purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
        })
      );
      expect(result.statusCode).toBe(401);
    } finally {
      jest.useRealTimers();
    }
  });

  it('fails closed when the signing secret is missing or too short', async () => {
    delete process.env['VAULT_TOKEN_SECRET'];
    const missing = await rpcError(issueDrop());
    expect(missing.statusCode).toBe(503);

    process.env['VAULT_TOKEN_SECRET'] = 'too-short';
    const short = await rpcError(issueDrop());
    expect(short.statusCode).toBe(503);
  });

  it('rejects issuance with an unsafe tenant, document, purpose, or expiry', async () => {
    const badTenant = await rpcError(issueDrop({ tenantId: '' }));
    expect(badTenant.statusCode).toBe(400);

    const badDocument = await rpcError(issueDrop({ documentId: '  ' }));
    expect(badDocument.statusCode).toBe(400);

    const badPurpose = await rpcError(issueDrop({ purpose: 'admin' as never }));
    expect(badPurpose.statusCode).toBe(400);

    const badExpiry = await rpcError(issueDrop({ expiresInSeconds: 86401 }));
    expect(badExpiry.statusCode).toBe(400);
  });
});
