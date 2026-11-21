import { createHmac } from 'node:crypto';
import { AppController } from './app.controller';

describe('directory acknowledgement boundary', () => {
  const original = { ...process.env };
  const signingKey = 'receipt-signing-key-only-directory-social';
  const communityId = '12345678-1234-1234-1234-123456789abc';
  const service = { deleteDirectoryChange: jest.fn() };
  const controller = Object.assign(Object.create(AppController.prototype), {
    communityService: service,
  });
  const token = (revision: string, id: string) =>
    createHmac('sha256', signingKey)
      .update(`directory-receipt-v1:${revision}:${id}`)
      .digest('hex');
  beforeEach(() => {
    process.env.DIRECTORY_SOCIAL_SECRET = 'worker-secret';
    process.env.DIRECTORY_RECEIPT_SIGNING_SECRET = signingKey;
    service.deleteDirectoryChange.mockClear();
  });
  afterAll(() => {
    process.env = original;
  });
  it('keeps an authenticated v2 ACK fenced until durable recovery completion exists', async () => {
    const identity = {
      revision: '12',
      communityId,
      eventNonce: '22345678-1234-1234-1234-123456789abc',
      sourceEpoch: '32345678-1234-1234-1234-123456789abc',
      recoveryEpoch: '42345678-1234-1234-1234-123456789abc',
    };
    const canonical =
      'directory-receipt-v2:' +
      Object.values(identity)
        .map((x) => `${Buffer.byteLength(x)}:${x}`)
        .join('');
    const attestation = createHmac('sha256', signingKey)
      .update(canonical)
      .digest('hex');
    await expect(
      controller.directoryAck({
        ...identity,
        attestation,
        secret: 'worker-secret',
      })
    ).rejects.toThrow('fenced');
    expect(service.deleteDirectoryChange).not.toHaveBeenCalled();
  });
  it('rejects even a valid v1 attestation without deleting an event', async () => {
    const valid = {
      revision: '12',
      communityId,
      secret: 'worker-secret',
      attestation: token('12', communityId),
    };
    for (const patch of [
      { secret: 'wrong' },
      { attestation: '' },
      { attestation: '0'.repeat(64) },
      { revision: '13' },
      { communityId: '12345678-1234-1234-1234-123456789abd' },
    ]) {
      await expect(
        controller.directoryAck({ ...valid, ...patch })
      ).rejects.toThrow();
    }
    expect(service.deleteDirectoryChange).not.toHaveBeenCalled();
    await expect(controller.directoryAck(valid)).rejects.toThrow();
    expect(service.deleteDirectoryChange).not.toHaveBeenCalled();
  });
});
