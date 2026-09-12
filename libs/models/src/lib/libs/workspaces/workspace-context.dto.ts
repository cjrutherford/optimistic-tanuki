import type { ResolvedWorkspace } from './workspace.dto';

/** Additive request context for newly migrated gateway-to-service calls. */
export interface WorkspaceContext {
  workspace: ResolvedWorkspace;
}
