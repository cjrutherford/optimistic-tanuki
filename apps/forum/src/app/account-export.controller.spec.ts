import { ForumAccountExportController } from './account-export.controller';

describe('ForumAccountExportController', () => {
  it('passes only the account subject and session envelope to the preview participant', async () => {
    const accountExport = {
      getAccountExportSnapshot: jest
        .fn()
        .mockResolvedValue({ status: 'partial' }),
    };
    const controller = new ForumAccountExportController(accountExport as never);

    const result = await controller.getAccountExportSnapshot({
      accountId: 'account-id',
      token: 'session-token',
      appId: 'app-id',
      profileIds: ['caller-controlled'],
    });

    expect(accountExport.getAccountExportSnapshot).toHaveBeenCalledWith(
      'account-id',
      { token: 'session-token', appId: 'app-id' }
    );
    expect(result).toEqual({ status: 'partial' });
  });
});
