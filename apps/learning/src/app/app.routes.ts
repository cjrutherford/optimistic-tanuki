import { Routes } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { LandingComponent } from './landing.component';
import { DashboardComponent } from './dashboard.component';
import { ModuleComponent } from './module.component';
import { LessonComponent } from './lesson.component';

export const appRoutes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'module/:trackId/:moduleId', component: ModuleComponent },
  { path: 'module/:trackId/:moduleId/:lessonId', component: LessonComponent },
  ...oauthCallbackRoutes,
];
