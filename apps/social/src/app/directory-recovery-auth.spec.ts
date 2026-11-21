import { AppController } from './app.controller';

describe('recovery read RPC authentication', () => {
  const saved = { ...process.env };
  const service = {
    recoveryDirectoryCensus: jest.fn(),
    recoveryDirectorySnapshot: jest.fn(),
  };
  const controller = Object.assign(Object.create(AppController.prototype), {
    communityService: service,
  });
  const secret = 'recovery-secret-01234567890123456789';
  beforeEach(() => {
    process.env.DIRECTORY_RECOVERY_READ_SECRET = secret;
    jest.clearAllMocks();
  });
  afterAll(() => {
    process.env = saved;
  });
  it.each(['recoveryDirectoryCensus', 'recoveryDirectorySnapshot'])(
    '%s fails closed and accepts only its dedicated credential',
    async (method) => {
      for (const bad of [undefined, 'wrong'])
        await expect(controller[method]({ secret: bad })).rejects.toThrow();
      delete process.env.DIRECTORY_RECOVERY_READ_SECRET;
      await expect(controller[method]({ secret })).rejects.toThrow();
      process.env.DIRECTORY_RECOVERY_READ_SECRET = 'short';
      await expect(controller[method]({ secret: 'short' })).rejects.toThrow();
      for (const name of [
        'DIRECTORY_SOCIAL_SECRET',
        'DIRECTORY_ELIGIBILITY_SECRET',
        'DIRECTORY_RECEIPT_SIGNING_SECRET',
      ]) {
        process.env.DIRECTORY_RECOVERY_READ_SECRET = secret;
        process.env[name] = secret;
        await expect(controller[method]({ secret })).rejects.toThrow();
        delete process.env[name];
      }
      await expect(
        controller[method]({
          secret,
          id: 'id',
          expectedSourceEpoch: 'epoch',
          cursor: 'cursor',
          limit: 2,
        })
      ).resolves.toBeUndefined();
      expect(service[method]).toHaveBeenCalledTimes(1);
    }
  );
});
