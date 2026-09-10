import { SetMetadata } from '@nestjs/common';
import {
  WorkspaceKind,
  WorkspaceSourceService,
} from '@optimistic-tanuki/models';

export const WORKSPACE_CONTEXT_KEY = 'workspace-context';

export interface WorkspaceContextRequirement {
  /** A single kind for legacy routes, or an explicit allow-list for polymorphic routes. */
  kind?: WorkspaceKind;
  supportedKinds?: readonly WorkspaceKind[];
  source: 'params' | 'body' | 'query';
  path: string;
  strict?: boolean;
  optional?: boolean;
  sourceService?: WorkspaceSourceService;
  resource?: 'member' | 'invite';
}

export const WorkspaceContext = (requirement: WorkspaceContextRequirement) =>
  SetMetadata(WORKSPACE_CONTEXT_KEY, requirement);
