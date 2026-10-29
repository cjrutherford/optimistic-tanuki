export const WorkspaceCommands = {
  FENCE_ACCOUNT_DELETION: 'workspace.deletion.fence',
  ERASE_ACCOUNT_DELETION: 'workspace.deletion.erase',
  READBACK_ACCOUNT_DELETION: 'workspace.deletion.readback',
  REGISTER: 'workspace.register',
  ACTIVATE: 'workspace.activate',
  RESOLVE: 'workspace.resolve',
  RESOLVE_BY_SOURCE: 'workspace.resolve-by-source',
  LIST_OWNED: 'workspace.list-owned',
  RESOLVE_OWNED: 'workspace.resolve-owned',
  OPEN_ACCOUNT_EXPORT_CAPTURE: 'Workspace:OpenAccountExportCapture',
  READ_ACCOUNT_EXPORT_CAPTURE: 'Workspace:ReadAccountExportCapture',
  RELEASE_ACCOUNT_EXPORT_CAPTURE: 'Workspace:ReleaseAccountExportCapture',
} as const;

export const WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES = ['Workspace'] as const;
