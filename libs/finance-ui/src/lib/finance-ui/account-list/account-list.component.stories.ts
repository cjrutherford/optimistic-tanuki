import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { StoryFinanceService } from '../finance.fixtures';
import { FinanceService } from '@optimistic-tanuki/finance-data-access';
import { AccountListComponent } from './account-list.component';

const meta: Meta<AccountListComponent> = {
  component: AccountListComponent,
  title: 'Accounts',
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
type Story = StoryObj<AccountListComponent>;

export const Default: Story = {};
