import { Route } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { LeadsComponent } from './leads.component';
import { AnalyticsComponent } from './analytics.component';

export const appRoutes: Route[] = [
  { path: '', component: DashboardComponent },
  { path: 'leads', component: LeadsComponent },
  { path: 'analytics', component: AnalyticsComponent },
];
