import { InjectionToken } from '@angular/core';
import { FinanceWorkspace } from '../models';

export interface FinanceHostWorkspaceConfig {
  label: string;
  navLabel: string;
  description: string;
}

export interface FinanceHostConfig {
  routeBase: string;
  shellTitle: string;
  authGuardLabel?: string;
  defaultWorkspace: FinanceWorkspace;
  redirectTo?: string;
  isReady?: () => boolean | Promise<boolean>;
  workspaceLabels?: Partial<
    Record<FinanceWorkspace, Partial<FinanceHostWorkspaceConfig>>
  >;
}

export const DEFAULT_FINANCE_HOST_CONFIG: FinanceHostConfig = {
  routeBase: '/finance',
  shellTitle: 'Finance Workspace',
  authGuardLabel: 'Finance access',
  defaultWorkspace: 'personal',
  redirectTo: '/login',
  isReady: () => true,
};

export const FINANCE_HOST_CONFIG = new InjectionToken<FinanceHostConfig>(
  'FINANCE_HOST_CONFIG',
  {
    factory: () => DEFAULT_FINANCE_HOST_CONFIG,
  }
);
