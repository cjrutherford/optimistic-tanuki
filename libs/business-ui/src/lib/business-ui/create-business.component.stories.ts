import type { Meta, StoryObj } from '@storybook/angular';
import { CreateBusinessComponent } from './create-business.component';

const meta: Meta<CreateBusinessComponent> = {
  component: CreateBusinessComponent,
  title: 'Create Business',
  tags: ['autodocs'],
  args: {
    localityId: 'locality-1',
    localityName: 'Savannah',
    submitting: false,
  },
  argTypes: {
    created: { action: 'created' },
    cancelled: { action: 'cancelled' },
  },
};

export default meta;
type Story = StoryObj<CreateBusinessComponent>;

export const Blank: Story = {};

export const Submitting: Story = {
  args: { submitting: true },
};
