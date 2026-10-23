jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {
    constructor(
      _dataSource: unknown,
      _identities: unknown,
      _auth: unknown,
      readonly options: unknown
    ) {}
  },
  AccountExportProfileSnapshotClient: class {},
}));

import { WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { AccountExportPostgresOwnerService } from '@optimistic-tanuki/storage';
import { createWorkspaceAccountExportSources } from './account-export-sources';
import { WorkspaceAccountExportOwnerService } from './account-export-owner.service';

describe('WorkspaceAccountExportOwnerService', () => {
  it('configures the shared owner with the workspace participant and source factory', () => {
    const owner = new WorkspaceAccountExportOwnerService(
      {} as any,
      {} as any,
      {} as any
    );
    expect(owner).toBeInstanceOf(AccountExportPostgresOwnerService);
    expect((owner as any).options).toMatchObject({
      participantId: 'workspace',
      sources: WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createWorkspaceAccountExportSources,
    });
  });
});
