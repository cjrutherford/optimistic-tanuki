import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import {
  StoryBusinessApiService,
  StoryBusinessAuthService,
  StoryBusinessSiteConfigStore,
} from './business-portal.fixtures';
import { BusinessOwnerDashboardPageComponent } from './business-owner-dashboard-page.component';

const meta: Meta<BusinessOwnerDashboardPageComponent> = {
  component: BusinessOwnerDashboardPageComponent,
  title: 'Owner/Dashboard',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    applicationConfig({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: BusinessApiService, useClass: StoryBusinessApiService },
        { provide: BusinessAuthService, useClass: StoryBusinessAuthService },
        {
          provide: BusinessSiteConfigStore,
          useClass: StoryBusinessSiteConfigStore,
        },
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<BusinessOwnerDashboardPageComponent>;

export const Default: Story = {};
