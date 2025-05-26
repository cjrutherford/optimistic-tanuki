import type { Meta, StoryObj } from '@storybook/angular';
import { NotificationComponent } from './notification.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<NotificationComponent> = {
  component: NotificationComponent,
  title: 'NotificationComponent',
};
export default meta;
type Story = StoryObj<NotificationComponent>;

export const Primary: Story = {
  args: {
    notifications: [],
  },
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/notification works!/gi)).toBeTruthy();
  },
};

export const WithNotifications: Story = {
  args: {
    notifications: [
      {
        id: 1,
        message: 'Info notification',
        severity: 'info',
        actions: [{ label: 'Action 1', callback: () => console.log('Action 1 clicked') }],
        read: false,
      },
      {
        id: 2,
        message: 'Warning notification',
        severity: 'warning',
        actions: [{ label: 'Action 2', callback: () => console.log('Action 2 clicked') }],
        read: false,
      },
      {
        id: 3,
        message: 'Error notification',
        severity: 'error',
        actions: [{ label: 'Action 3', callback: () => console.log('Action 3 clicked') }],
        read: false,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(canvas.getByText(/info notification/gi)).toBeTruthy();
    expect(canvas.getByText(/warning notification/gi)).toBeTruthy();
    expect(canvas.getByText(/error notification/gi)).toBeTruthy();
  },
};
