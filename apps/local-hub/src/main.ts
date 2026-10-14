import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { startGatedPerformanceMonitoring } from '@optimistic-tanuki/common-ui';

startGatedPerformanceMonitoring({ appId: 'local-hub' });

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
