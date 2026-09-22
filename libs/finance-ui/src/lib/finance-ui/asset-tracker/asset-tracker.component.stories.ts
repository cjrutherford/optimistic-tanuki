import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { StoryFinanceService } from '../finance.fixtures';
import { FinanceService } from '@optimistic-tanuki/finance-data-access';
import { AssetTrackerComponent } from './asset-tracker.component';

const meta: Meta<AssetTrackerComponent> = {
  component: AssetTrackerComponent,
  title: 'Assets',
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
type Story = StoryObj<AssetTrackerComponent>;

export const Default: Story = {};
