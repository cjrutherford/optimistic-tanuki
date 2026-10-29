import { ForumCommands } from './forum';

describe('Forum account export command', () => {
  it('exposes a dedicated internal authored snapshot command', () => {
    expect(ForumCommands.GetAccountExportSnapshot).toBe(
      'GET_FORUM_ACCOUNT_EXPORT_SNAPSHOT'
    );
  });
});
