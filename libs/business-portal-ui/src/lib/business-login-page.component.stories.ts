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
import { BusinessLoginPageComponent } from './business-login-page.component';

const meta: Meta<BusinessLoginPageComponent> = {
  component: BusinessLoginPageComponent,
  title: 'Owner/Login',
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
type Story = StoryObj<BusinessLoginPageComponent>;

export const Default: Story = {};
