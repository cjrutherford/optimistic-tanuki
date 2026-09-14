import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { StoryFinanceService } from '../finance.fixtures';
import { FinanceService } from '../services';
import { BusinessPaymentsComponent } from './business-payments.component';

const meta: Meta<BusinessPaymentsComponent> = {
  component: BusinessPaymentsComponent,
  title: 'Business Payments',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    applicationConfig({
      providers: [
        provideRouter([]),
        { provide: FinanceService, useClass: StoryFinanceService },
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<BusinessPaymentsComponent>;

export const Default: Story = {};
