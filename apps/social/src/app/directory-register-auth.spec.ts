import { AppController } from './app.controller';

describe('directory register RPC authentication', () => {
  const saved = { ...process.env };
  const service = {
    scanDirectoryRegister: jest.fn(),
    readDirectoryRegisterSnapshot: jest.fn(),
    scanDirectoryRegisterV2: jest.fn(),
    readDirectoryRegisterSnapshotV2: jest.fn(),
    readCurrentDirectoryRegister: jest.fn(),
    readCurrentDirectoryGeography: jest.fn(),
    scanSourceCommunities: jest.fn(),
    repairSourceCommunityRegister: jest.fn(),
  };
  const controller = Object.assign(Object.create(AppController.prototype), {
    communityService: service,
  });
  const secret = 'register-read-secret-012345678901234567890123';
  beforeEach(() => {
    process.env.DIRECTORY_REGISTER_READ_SECRET = secret;
    delete process.env.DIRECTORY_REGISTER_REPAIR_SECRET;
    jest.clearAllMocks();
  });
  afterAll(() => {
    process.env = saved;
  });

  it.each([
    [
      'directoryRegisterScan',
      { sourceEpoch: 'epoch', afterCommunityId: null, limit: 10 },
    ],
    [
      'directoryRegisterRead',
      { sourceEpoch: 'epoch', communityId: 'id', changeToken: 'token' },
    ],
    [
      'directoryRegisterScanV2',
      { identity: {}, afterCommunityId: null, limit: 10 },
    ],
    [
      'directoryRegisterReadV2',
      { identity: {}, communityId: 'id', changeToken: 'token' },
    ],
    ['directoryRegisterCurrentV2', { identity: {}, communityId: 'id' }],
    ['directoryGeographyCurrentV2', { identity: {}, communityId: 'id' }],
    [
      'directorySourceCensusV2',
      { identity: {}, afterCommunityId: null, limit: 10 },
    ],
  ])(
    '%s fails closed for missing, wrong, weak, and reused credentials',
    async (method, args) => {
      await expect(
        controller[method]({ ...args, secret: undefined })
      ).rejects.toThrow();
      await expect(
        controller[method]({ ...args, secret: 'wrong' })
      ).rejects.toThrow();
      delete process.env.DIRECTORY_REGISTER_READ_SECRET;
      await expect(controller[method]({ ...args, secret })).rejects.toThrow();
      process.env.DIRECTORY_REGISTER_READ_SECRET = 'too-short';
      await expect(
        controller[method]({ ...args, secret: 'too-short' })
      ).rejects.toThrow();
      for (const key of [
        'DIRECTORY_SOCIAL_SECRET',
        'DIRECTORY_ELIGIBILITY_SECRET',
        'DIRECTORY_RECOVERY_READ_SECRET',
        'DIRECTORY_RECEIPT_SIGNING_SECRET',
        'DIRECTORY_REGISTER_REPAIR_SECRET',
      ]) {
        process.env.DIRECTORY_REGISTER_READ_SECRET = secret;
        process.env[key] = secret;
        await expect(controller[method]({ ...args, secret })).rejects.toThrow();
        delete process.env[key];
      }
    }
  );

  it('requires an independent repair secret', async () => {
    const repairSecret = 'register-repair-secret-012345678901234567890';
    const args = { identity: {}, communityId: 'id' };
    process.env.DIRECTORY_REGISTER_REPAIR_SECRET = repairSecret;
    await expect(
      controller.directorySourceRepairV2({ ...args, secret })
    ).rejects.toThrow();
    await controller.directorySourceRepairV2({ ...args, secret: repairSecret });
    expect(service.repairSourceCommunityRegister).toHaveBeenCalledWith(
      args.identity,
      args.communityId
    );
    process.env.DIRECTORY_REGISTER_REPAIR_SECRET = secret;
    await expect(
      controller.directorySourceRepairV2({ ...args, secret })
    ).rejects.toThrow();
  });

  it('routes authenticated reads only to their service helper path and does not log credentials', async () => {
    const log = jest.spyOn(console, 'log');
    await controller.directoryRegisterScan({
      sourceEpoch: 'epoch',
      afterCommunityId: null,
      limit: 10,
      secret,
    });
    await controller.directoryRegisterRead({
      sourceEpoch: 'epoch',
      communityId: 'id',
      changeToken: 'token',
      secret,
    });
    const identity = {
      sourceEpoch: 'epoch',
      activationId: 'activation',
      socialGeneration: '1',
    };
    await controller.directoryRegisterScanV2({
      identity,
      afterCommunityId: null,
      limit: 10,
      secret,
    });
    await controller.directoryRegisterReadV2({
      identity,
      communityId: 'id',
      changeToken: 'token',
      secret,
    });
    await controller.directoryRegisterCurrentV2({
      identity,
      communityId: 'id',
      secret,
    });
    await controller.directoryGeographyCurrentV2({
      identity,
      communityId: 'id',
      secret,
    });
    expect(service.readCurrentDirectoryGeography).toHaveBeenCalledWith(
      identity,
      'id'
    );
    expect(service.scanDirectoryRegisterV2).toHaveBeenCalledWith(
      identity,
      null,
      10
    );
    expect(service.readDirectoryRegisterSnapshotV2).toHaveBeenCalledWith(
      identity,
      'id',
      'token'
    );
    expect(service.readCurrentDirectoryRegister).toHaveBeenCalledWith(
      identity,
      'id'
    );
    expect(service.scanDirectoryRegister).toHaveBeenCalledWith(
      'epoch',
      null,
      10
    );
    expect(service.readDirectoryRegisterSnapshot).toHaveBeenCalledWith(
      'epoch',
      'id',
      'token'
    );
    expect(service.scanDirectoryRegister).toHaveBeenCalledTimes(1);
    expect(service.readDirectoryRegisterSnapshot).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining(secret));
    log.mockRestore();
  });
});
