import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { StoryFinanceService } from '../finance.fixtures';
import { FinanceService } from '../services';
import { InvoiceEditorComponent } from './invoice-editor.component';

const meta: Meta<InvoiceEditorComponent> = {
  component: InvoiceEditorComponent,
  title: 'Invoice Editor',
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
type Story = StoryObj<InvoiceEditorComponent>;

export const Default: Story = {};
