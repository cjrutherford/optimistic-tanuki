import type { Meta, StoryObj } from '@storybook/angular';
import { BusinessCardComponent } from './business-card.component';
import { sampleBusiness } from './business.fixtures';

const meta: Meta<BusinessCardComponent> = {
  component: BusinessCardComponent,
  title: 'Business Card',
  tags: ['autodocs'],
  args: { business: sampleBusiness },
};

export default meta;
type Story = StoryObj<BusinessCardComponent>;

export const Pro: Story = {};

export const BasicWithoutLogo: Story = {
  args: {
    business: { ...sampleBusiness, tier: 'basic', logoUrl: undefined },
  },
};

export const PastDue: Story = {
  args: {
    business: {
      ...sampleBusiness,
      status: 'past-due',
      subscriptionStatus: 'past-due',
    },
  },
};
