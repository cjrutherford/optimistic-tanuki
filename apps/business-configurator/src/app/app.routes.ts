import { Route } from '@angular/router';
import {
  ConfiguratorWizardComponent,
  CONFIGURATOR_ROUTES,
} from './pages/configurator-wizard.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: ConfiguratorWizardComponent,
    title: 'Business Site Builder',
  },
  { path: '**', redirectTo: '' },
];
