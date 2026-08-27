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
import { AboutComponent } from './about.component';
import { DocsComponent } from './docs.component';

export const appRoutes: Routes = [
  // The landing page is the entrance, and the catalog is where you go once
  // you have decided. It was the other way round, which meant the front door
  // answered "what is here" and never answered "why would I".
  { path: '', component: LandingComponent, title: "Let's Go" },
  { path: 'courses', component: CatalogComponent, title: "Courses | Let's Go" },
  {
    path: 'course/:offeringId',
    component: OfferingComponent,
    title: "Course | Let's Go",
  },
  { path: 'sign-in', component: SignInComponent, title: "Sign in | Let's Go" },
  { path: 'about', component: AboutComponent, title: "About | Let's Go" },
  { path: 'docs', component: DocsComponent, title: "Docs | Let's Go" },
  {
    path: 'dashboard',
    component: DashboardComponent,
    title: "Your progress | Let's Go",
  },
  { path: 'author', component: AuthorComponent, title: "Authoring | Let's Go" },
  {
    path: 'author/:offeringId',
    component: CourseEditorComponent,
    title: "Edit course | Let's Go",
  },
  {
    path: 'module/:trackId/:moduleId',
    component: ModuleComponent,
    title: "Module | Let's Go",
  },
  {
    path: 'module/:trackId/:moduleId/:lessonId',
    component: LessonComponent,
    title: "Lesson | Let's Go",
  },
  ...oauthCallbackRoutes,
];
