import { Route } from '@angular/router';
import { LeadsShellComponent } from './leads-ui/leads-shell.component';

export function provideLeadsRoutes(): Route[] {
  return [
    {
      path: '',
      component: LeadsShellComponent,
    },
  ];
}

export const leadsUiRoutes: Route[] = [
  { path: '', component: LeadsShellComponent },
];
