import { SetMetadata } from '@nestjs/common';
import {
  WorkspaceKind,
  WorkspaceSourceService,
} from '@optimistic-tanuki/models';

export const WORKSPACE_CONTEXT_KEY = 'workspace-context';

export interface WorkspaceContextRequirement {
  kind: WorkspaceKind;
  source: 'params' | 'body' | 'query';
  path: string;
  strict?: boolean;
  optional?: boolean;
  sourceService?: WorkspaceSourceService;
  resource?: 'member' | 'invite';
}

export const WorkspaceContext = (requirement: WorkspaceContextRequirement) =>
  SetMetadata(WORKSPACE_CONTEXT_KEY, requirement);
