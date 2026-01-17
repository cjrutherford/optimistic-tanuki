import { Section, LayoutType } from './section.model';
import { RouteConfig } from './route-config.model';
import { ThemeConfig } from './theme-config.model';
import { FeaturesConfig } from './feature-config.model';

/**
 * Landing page configuration
 */
export interface LandingPageConfig {
  sections: Section[];
  layout: LayoutType;
}

/**
 * Main application configuration interface
 */
export interface AppConfiguration {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  landingPage: LandingPageConfig;
  routes: RouteConfig[];
  features: FeaturesConfig;
  theme: ThemeConfig;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * DTO for creating a new app configuration
 */
export interface CreateAppConfigDto {
  name: string;
  description?: string;
  domain?: string;
  landingPage: LandingPageConfig;
  routes: RouteConfig[];
  features: FeaturesConfig;
  theme: ThemeConfig;
  active?: boolean;
}

/**
 * DTO for updating an existing app configuration
 */
export interface UpdateAppConfigDto {
  name?: string;
  description?: string;
  domain?: string;
  landingPage?: LandingPageConfig;
  routes?: RouteConfig[];
  features?: FeaturesConfig;
  theme?: ThemeConfig;
  active?: boolean;
}
