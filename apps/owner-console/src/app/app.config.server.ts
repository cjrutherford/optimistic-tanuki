import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

// Provide prerender params for routes with parameters to avoid build-time errors
// when no specific IDs are available for static prerendering. Returning an
// empty array for the parametric route tells the prerenderer to skip pre-rendering
// instances of that route.
export async function getPrerenderParams() {
  return {
    // Provide a small set of placeholder IDs so the prerenderer will emit
    // at least one static instance instead of failing when parameters are present.
    'dashboard/app-config/designer/:id': [{ id: 'sample' }],
    '/dashboard/app-config/designer/:id': [{ id: 'sample' }],
  } as Record<string, Array<Record<string, string>>>;
}
