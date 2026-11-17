import { AppController } from './app.controller';

describe('directory RPC authentication', () => {
  const original = process.env.DIRECTORY_SOCIAL_SECRET;
  const originalEligibility = process.env.DIRECTORY_ELIGIBILITY_SECRET;
  const service = { assertDirectoryReady: jest.fn(), directorySnapshot: jest.fn(), directoryMembership: jest.fn(), directoryUnread: jest.fn(), findDirectoryCensus: jest.fn(), findDirectoryEligible: jest.fn() };
  const controller = Object.assign(Object.create(AppController.prototype), { communityService: service });
  afterAll(() => { if (original === undefined) delete process.env.DIRECTORY_SOCIAL_SECRET; else process.env.DIRECTORY_SOCIAL_SECRET = original; if (originalEligibility === undefined) delete process.env.DIRECTORY_ELIGIBILITY_SECRET; else process.env.DIRECTORY_ELIGIBILITY_SECRET = originalEligibility; });
  it('rejects a credentialed request when readiness is fenced', async () => {
    process.env.DIRECTORY_SOCIAL_SECRET = 'worker';
    service.assertDirectoryReady.mockRejectedValueOnce(new Error('not ready'));
    await expect(controller.directoryUnread({ secret: 'worker' })).rejects.toThrow('not ready');
    expect(service.directoryUnread).not.toHaveBeenCalled();
  });
  it('restricts eligibility credentials to the eligibility RPC', async () => {
    process.env.DIRECTORY_SOCIAL_SECRET = 'worker';
    process.env.DIRECTORY_ELIGIBILITY_SECRET = 'gateway-credential-0123456789012345';
    await expect(controller.findDirectoryEligible({ id: 'x', secret: 'gateway-credential-0123456789012345' })).resolves.toBeUndefined();
    await expect(controller.directoryUnread({ secret: 'gateway-credential-0123456789012345' })).rejects.toThrow();
    await expect(controller.findDirectoryEligible({ id: 'x', secret: 'worker' })).rejects.toThrow();
    process.env.DIRECTORY_ELIGIBILITY_SECRET = 'worker';
    await expect(controller.findDirectoryEligible({ id: 'x', secret: 'worker' })).rejects.toThrow();
  });
  it.each(['directorySnapshot', 'directoryMembership', 'directoryUnread', 'findDirectoryCensus'])('%s fails closed and accepts the configured credential', async method => {
    delete process.env.DIRECTORY_SOCIAL_SECRET;
    await expect(controller[method]({ id: 'x', secret: 'test' })).rejects.toThrow();
    process.env.DIRECTORY_SOCIAL_SECRET = 'test';
    await expect(controller[method]({ id: 'x', secret: 'wrong' })).rejects.toThrow();
    await expect(controller[method]({ id: 'x' })).rejects.toThrow();
    await expect(controller[method]({ id: 'x', secret: 'test' })).resolves.toBeUndefined();
  });
  it('passes the authenticated expected epoch to each recovery read', async () => {
    process.env.DIRECTORY_SOCIAL_SECRET = 'test';
    const expectedSourceEpoch = '00000000-0000-4000-8000-000000000001';
    await controller.directorySnapshot({ id: 'town', expectedSourceEpoch, expectedEventNonce: 'nonce', secret: 'test' });
    await controller.directoryMembership({ revision: '1', communityId: 'town', expectedSourceEpoch, expectedEventNonce: 'nonce', secret: 'test' });
    await controller.findDirectoryCensus({ cursor: 'cursor', limit: 5, expectedSourceEpoch, expectedEventNonce: 'nonce', secret: 'test' });
    expect(service.directorySnapshot).toHaveBeenLastCalledWith('town', expectedSourceEpoch);
    expect(service.directoryMembership).toHaveBeenLastCalledWith('1', 'town', expectedSourceEpoch, 'nonce');
    expect(service.findDirectoryCensus).toHaveBeenLastCalledWith(expectedSourceEpoch, 'cursor', 5);
  });

});
