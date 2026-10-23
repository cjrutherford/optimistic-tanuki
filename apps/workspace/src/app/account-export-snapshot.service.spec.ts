jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {
    constructor(..._args: unknown[]) {}
  },
  AccountExportProfileSnapshotClient: class {},
  AccountExportOwnerSpoolService: class {},
  AccountExportProfileBoundSnapshotService: class {
    readonly participantId: string;
    readonly sources: readonly string[];
    constructor(
      _owner: unknown,
      _spool: unknown,
      _auth: unknown,
      config: { participantId: string; sources: readonly string[] }
    ) {
      this.participantId = config.participantId;
      this.sources = config.sources;
    }
  },
  AccountExportProfileBoundSnapshotError: class extends Error {},
}));

import { WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { AccountExportProfileBoundSnapshotService } from '@optimistic-tanuki/storage';
import { WorkspaceAccountExportOwnerService } from './account-export-owner.service';
import { WorkspaceAccountExportSnapshotService } from './account-export-snapshot.service';

describe('WorkspaceAccountExportSnapshotService', () => {
  it('wraps the shared profile-bound snapshot implementation', () => {
    const service = new WorkspaceAccountExportSnapshotService(
      {} as WorkspaceAccountExportOwnerService,
      {} as any,
      {} as any
    );
    expect(service).toBeInstanceOf(AccountExportProfileBoundSnapshotService);
    expect((service as any).participantId).toBe('workspace');
    expect((service as any).sources).toEqual(
      WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
  });
});
