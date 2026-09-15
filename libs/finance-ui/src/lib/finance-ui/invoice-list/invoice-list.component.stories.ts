import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { StoryFinanceService } from '../finance.fixtures';
import { FinanceService } from '../services';
import { InvoiceListComponent } from './invoice-list.component';

const meta: Meta<InvoiceListComponent> = {
  component: InvoiceListComponent,
  title: 'Invoices',
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
type Story = StoryObj<InvoiceListComponent>;

export const Default: Story = {};
