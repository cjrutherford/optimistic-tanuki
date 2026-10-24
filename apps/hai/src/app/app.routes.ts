import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./components/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
  {
    path: 'private-cloud',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/private-cloud/private-cloud-page.component').then(
        (m) => m.PrivateCloudPageComponent
      ),
  },
  {
    path: 'private-cloud/home',
    loadComponent: () =>
      import(
        './pages/private-cloud-home/private-cloud-home-page.component'
      ).then((m) => m.PrivateCloudHomePageComponent),
  },
  {
    path: 'private-cloud/organizations',
    loadComponent: () =>
      import(
        './pages/private-cloud-organizations/private-cloud-organizations-page.component'
      ).then((m) => m.PrivateCloudOrganizationsPageComponent),
  },
  {
    path: 'private-cloud/open-source-stack',
    loadComponent: () =>
      import('./pages/open-source-stack/open-source-stack-page.component').then(
        (m) => m.OpenSourceStackPageComponent
      ),
  },
  {
    path: 'private-cloud/assessment',
    loadComponent: () =>
      import('./pages/assessment/assessment-page.component').then(
        (m) => m.AssessmentPageComponent
      ),
  },
  {
    path: 'turn-key-appliances',
    loadComponent: () =>
      import(
        './pages/turn-key-appliances/turn-key-appliances-page.component'
      ).then((m) => m.TurnKeyAppliancesPageComponent),
  },
  {
    path: 'software-stacks',
    loadComponent: () =>
      import('./pages/software-stacks/software-stacks-page.component').then(
        (m) => m.SoftwareStacksPageComponent
      ),
  },
  {
    path: 'cost-comparison',
    loadComponent: () =>
      import('./pages/cost-comparison/cost-comparison-page.component').then(
        (m) => m.CostComparisonPageComponent
      ),
  },
  {
    path: 'custom-software',
    loadComponent: () =>
      import('./pages/custom-software/custom-software-page.component').then(
        (m) => m.CustomSoftwarePageComponent
      ),
  },
  {
    path: 'partners',
    loadComponent: () =>
      import('./pages/partners/partners-page.component').then(
        (m) => m.PartnersPageComponent
      ),
  },
  {
    path: 'how-we-work',
    loadComponent: () =>
      import('./pages/how-we-work/how-we-work-page.component').then(
        (m) => m.HowWeWorkPageComponent
      ),
  },
  {
    path: 'web-design',
    loadComponent: () =>
      import('./pages/web-design/web-design.component').then(
        (m) => m.WebDesignComponent
      ),
  },
  {
    path: 'hardware-support-and-repair',
    loadComponent: () =>
      import('./pages/hardware-support/hardware-support.component').then(
        (m) => m.HardwareSupportComponent
      ),
  },
  {
    path: 'technical-training',
    loadComponent: () =>
      import('./pages/training/training.component').then(
        (m) => m.TrainingComponent
      ),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact-page.component').then(
        (m) => m.ContactPageComponent
      ),
  },
];
