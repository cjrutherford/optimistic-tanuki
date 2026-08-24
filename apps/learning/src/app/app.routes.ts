import { Routes } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { CatalogComponent } from './catalog.component';
import { OfferingComponent } from './offering.component';
import { AuthorComponent } from './author.component';
import { SignInComponent } from './sign-in.component';
import { CourseEditorComponent } from './course-editor.component';
import { DashboardComponent } from './dashboard.component';
import { ModuleComponent } from './module.component';
import { LessonComponent } from './lesson.component';

export const appRoutes: Routes = [
  // The catalog is the entrance. It used to be a landing page that sent
  // visitors straight into a course's module sidebar.
  { path: '', component: CatalogComponent },
  { path: 'course/:offeringId', component: OfferingComponent },
  { path: 'sign-in', component: SignInComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'author', component: AuthorComponent },
  { path: 'author/:offeringId', component: CourseEditorComponent },
  { path: 'module/:trackId/:moduleId', component: ModuleComponent },
  { path: 'module/:trackId/:moduleId/:lessonId', component: LessonComponent },
  ...oauthCallbackRoutes,
];
