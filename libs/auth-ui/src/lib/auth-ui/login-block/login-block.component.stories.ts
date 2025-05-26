import type { Meta, StoryObj } from '@storybook/angular';
import { LoginBlockComponent } from './login-block.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<LoginBlockComponent> = {
  component: LoginBlockComponent,
  title: 'LoginBlockComponent',
};
export default meta;
type Story = StoryObj<LoginBlockComponent>;

export const Primary: Story = {
  args: {
    title: 'Welcome Back!',
    description: 'Please login to continue',
    heroSrc: 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDJ8fGxvZ298ZW58MHx8fHwxNjg3NTY5NzA1&ixlib=rb-4.0.3&q=80&w=1080',
    heroAlt: 'Login Image',
  },
};

export const Heading: Story = {
  args: {
    title: 'Login',
    description: 'Access your account',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Login/gi)).toBeTruthy();
  },
};
