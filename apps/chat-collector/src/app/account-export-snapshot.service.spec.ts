jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
  AccountExportProfileBoundSnapshotService: class {
    constructor(...args: unknown[]) {
      (this as any).args = args;
    }
  },
  AccountExportProfileBoundSnapshotError: class extends Error {},
  AccountExportOwnerSpoolService: class {},
}));
import { CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { ChatAccountExportSnapshotService } from './account-export-snapshot.service';

it('uses the shared leased snapshot protocol for the canonical chat participant', () => {
  const snapshot = new ChatAccountExportSnapshotService(
    {} as any,
    {} as any,
    {} as any
  );
  expect((snapshot as any).args[3]).toEqual({
    participantId: 'chat-collector',
    sources: CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  });
});
