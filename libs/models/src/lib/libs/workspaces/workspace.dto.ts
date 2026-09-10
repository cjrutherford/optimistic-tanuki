export const WORKSPACE_KINDS = ['business-site', 'community'] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_STATUSES = [
  'draft',
  'active',
  'suspended',
  'archived',
] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export type WorkspaceSourceService = 'store' | 'social' | 'app-configurator';

const CANONICAL_WORKSPACE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function workspaceScopeName(workspaceId: string): string {
  if (!CANONICAL_WORKSPACE_ID.test(workspaceId)) {
    throw new Error('Workspace child scopes require a canonical UUID');
  }
  return `workspace:${workspaceId}`;
}

export interface WorkspaceSource {
  service: WorkspaceSourceService;
  sourceId: string;
}

export function isWorkspaceSource(value: unknown): value is WorkspaceSource {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const source = value as Partial<WorkspaceSource>;
  return (
    ['store', 'social', 'app-configurator'].includes(source.service ?? '') &&
    typeof source.sourceId === 'string' &&
    CANONICAL_WORKSPACE_ID.test(source.sourceId)
  );
}

export interface ResolveWorkspaceRequest {
  appScope: string;
  kind: WorkspaceKind;
  slug: string;
  requireActive?: boolean;
}

export interface ResolveWorkspaceBySourceRequest {
  appScope: string;
  source: WorkspaceSource;
  requireActive?: boolean;
}

export interface ListOwnedWorkspacesRequest {
  ownerUserId: string;
  ownerProfileId: string;
}

export interface ResolveOwnedWorkspaceRequest
  extends ListOwnedWorkspacesRequest {
  workspaceId: string;
}

export interface RegisterWorkspaceRequest {
  kind: WorkspaceKind;
  slug: string;
  displayName: string;
  appScope: string;
  ownerUserId: string;
  ownerProfileId: string;
  source: WorkspaceSource;
}

export interface ActivateWorkspaceRequest {
  workspaceId: string;
  appScope: string;
  source: WorkspaceSource;
}

export interface ResolvedWorkspace {
  workspaceId: string;
  kind: WorkspaceKind;
  slug: string;
  displayName: string;
  appScope: string;
  ownerUserId: string;
  ownerProfileId: string;
  status: WorkspaceStatus;
  source: WorkspaceSource;
}

export function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return (
    typeof value === 'string' &&
    (WORKSPACE_KINDS as readonly string[]).includes(value)
  );
}

export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return (
    typeof value === 'string' &&
    (WORKSPACE_STATUSES as readonly string[]).includes(value)
  );
}

export function isResolvedWorkspace(
  value: unknown
): value is ResolvedWorkspace {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const workspace = value as Partial<ResolvedWorkspace>;
  return (
    typeof workspace.workspaceId === 'string' &&
    CANONICAL_WORKSPACE_ID.test(workspace.workspaceId) &&
    typeof workspace.slug === 'string' &&
    typeof workspace.displayName === 'string' &&
    typeof workspace.appScope === 'string' &&
    typeof workspace.ownerUserId === 'string' &&
    typeof workspace.ownerProfileId === 'string' &&
    isWorkspaceKind(workspace.kind) &&
    isWorkspaceStatus(workspace.status) &&
    isWorkspaceSource(workspace.source)
  );
}
