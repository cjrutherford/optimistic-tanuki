/**
 * Route configuration for dynamic routing
 */
export interface RouteConfig {
  id: string;
  path: string;
  name: string;
  componentType: 'custom' | 'feature' | 'landing';
  featureName?: 'social' | 'tasks' | 'blogging' | 'projectPlanning';
  permissions?: string[];
  customConfig?: Record<string, unknown>;
  order: number;
  showInNav: boolean;
  icon?: string;
}
