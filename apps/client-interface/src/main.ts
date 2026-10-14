import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { startGatedPerformanceMonitoring } from '@optimistic-tanuki/common-ui';

startGatedPerformanceMonitoring({ appId: 'client-interface' });

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
