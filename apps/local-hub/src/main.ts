import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { startPerformanceMonitoring } from '@optimistic-tanuki/common-ui';

startPerformanceMonitoring({ appId: 'local-hub' });

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
