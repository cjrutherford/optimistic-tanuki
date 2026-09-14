import type { Meta, StoryObj } from '@storybook/angular';
import { BusinessDetailComponent } from './business-detail.component';
import { sampleBusiness } from './business.fixtures';

const meta: Meta<BusinessDetailComponent> = {
  component: BusinessDetailComponent,
  title: 'Business Detail',
  tags: ['autodocs'],
  args: { business: sampleBusiness, isOwner: false },
  argTypes: {
    editClicked: { action: 'editClicked' },
  },
};

export default meta;
type Story = StoryObj<BusinessDetailComponent>;

export const Visitor: Story = {};

export const Owner: Story = {
  args: { isOwner: true },
};
