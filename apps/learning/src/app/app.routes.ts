import { Routes } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { CatalogComponent } from './catalog.component';
import { OfferingComponent } from './offering.component';
import { AuthorComponent } from './author.component';
import { SignInComponent } from './sign-in.component';
import { CourseEditorComponent } from './course-editor.component';
import { DashboardComponent } from './dashboard.component';
import { ModuleComponent } from './module.component';
import { LandingComponent } from './landing.component';
import { LessonComponent } from './lesson.component';

export const appRoutes: Routes = [
  // The landing page is the entrance, and the catalog is where you go once
  // you have decided. It was the other way round, which meant the front door
  // answered "what is here" and never answered "why would I".
  { path: '', component: LandingComponent },
  { path: 'courses', component: CatalogComponent },
  { path: 'course/:offeringId', component: OfferingComponent },
  { path: 'sign-in', component: SignInComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'author', component: AuthorComponent },
  { path: 'author/:offeringId', component: CourseEditorComponent },
  { path: 'module/:trackId/:moduleId', component: ModuleComponent },
  { path: 'module/:trackId/:moduleId/:lessonId', component: LessonComponent },
  ...oauthCallbackRoutes,
];
