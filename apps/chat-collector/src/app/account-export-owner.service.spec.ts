jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {
    constructor(...args: unknown[]) {
      (this as any).options = args[3];
    }
  },
  AccountExportProfileSnapshotClient: class {},
}));
import { CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createChatAccountExportSources } from './account-export-sources';
import { ChatAccountExportOwnerService } from './account-export-owner.service';

it('configures the shared PostgreSQL owner as one leased chat participant', () => {
  const owner = new ChatAccountExportOwnerService(
    {} as any,
    {} as any,
    {} as any
  );
  expect((owner as any).options).toEqual({
    participantId: 'chat-collector',
    sources: CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    createSources: createChatAccountExportSources,
  });
});
