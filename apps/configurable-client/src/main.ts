import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { startPerformanceMonitoring } from '@optimistic-tanuki/common-ui';

startPerformanceMonitoring({ appId: 'configurable-client' });

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
