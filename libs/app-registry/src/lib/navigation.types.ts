import { AppRegistration } from './app-registry.types';

export type NavigationLinkType = 'nav' | 'action' | 'footer' | 'context';

export type NavigationPosition = 'primary' | 'secondary' | 'footer';

export interface NavigationLink {
  linkId: string;
  sourceAppId: string;
  targetAppId: string;
  type: NavigationLinkType;
  label: string;
  path?: string;
  queryParams?: Record<string, string>;
  requiresAuth?: boolean;
  position?: NavigationPosition;
  sortOrder?: number;
  iconName?: string;
  featureFlag?: string;
}

export interface NavigationContext {
  currentAppId: string;
  currentPath: string;
  isAuthenticated: boolean;
  userId?: string;
  queryParams?: Record<string, string>;
}

export interface GeneratedLink {
  url: string;
  target: AppRegistration;
  meta: {
    label: string;
    iconName?: string;
    opensNewTab: boolean;
  };
}

export interface NavigationOptions {
  newTab?: boolean;
  includeReturn?: boolean;
  preserveQuery?: boolean;
}
