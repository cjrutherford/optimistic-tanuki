import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { RenderMode, ServerRoute, provideServerRouting,  } from '@angular/ssr';

const serverRoutes: ServerRoute[] = [
  // {
  //   path: '',
  //   renderMode: RenderMode.Client,
  // },
  {
    path: 'register',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'feed',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'profile',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tasks',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Client
  }
]

/**
 * Server-specific application configuration.
 */
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};

/**
 * Merged application configuration for both client and server.
 */
export const config = mergeApplicationConfig(appConfig, serverConfig);
