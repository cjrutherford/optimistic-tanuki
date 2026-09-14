import type { Meta, StoryObj } from '@storybook/angular';
import { PaymentMethodSelectorComponent } from './payment-method-selector.component';

const meta: Meta<PaymentMethodSelectorComponent> = {
  component: PaymentMethodSelectorComponent,
  title: 'Payment Method Selector',
  tags: ['autodocs'],
  args: {
    title: 'Choose a payment method',
    selected: 'card',
  },
  argTypes: {
    selected: {
      control: 'select',
      options: ['card', 'cash-app', 'venmo', 'zelle', 'cash'],
    },
    methodChange: { action: 'methodChange' },
  },
};

export default meta;
type Story = StoryObj<PaymentMethodSelectorComponent>;

export const Card: Story = {};

export const PeerToPeer: Story = {
  args: {
    title: 'How would you like to pay?',
    description: 'Send the balance with the app you already use.',
    selected: 'venmo',
  },
};

export const Cash: Story = {
  args: { selected: 'cash' },
};
