import { Route } from '@angular/router';
import { AgendasPageComponent } from './components/agendas/agendas-page.component';
import { ProjectsPageComponent } from './components/projects/projects-page.component';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'agendas',
  },
  {
    path: 'agendas',
    component: AgendasPageComponent,
  },
  {
    path: 'projects',
    component: ProjectsPageComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
