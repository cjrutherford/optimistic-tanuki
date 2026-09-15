import type { Meta, StoryObj } from '@storybook/angular';
import { BusinessListComponent } from './business-list.component';
import { sampleBusinesses } from './business.fixtures';

const meta: Meta<BusinessListComponent> = {
  component: BusinessListComponent,
  title: 'Business List',
  tags: ['autodocs'],
  args: {
    businesses: sampleBusinesses,
    loading: false,
    showCreateButton: true,
  },
  argTypes: {
    createClicked: { action: 'createClicked' },
    businessClicked: { action: 'businessClicked' },
  },
};

export default meta;
type Story = StoryObj<BusinessListComponent>;

export const Directory: Story = {};

export const Loading: Story = {
  args: { businesses: [], loading: true },
};

export const Empty: Story = {
  args: { businesses: [] },
};
