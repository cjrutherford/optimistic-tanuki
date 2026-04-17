import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import {
  NotificationComponent,
  NotificationType,
  NotificationPosition,
  Notification,
} from './notification.component';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

const meta: Meta<NotificationComponent> = {
  component: NotificationComponent,
  title: 'Components/Notification',
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ButtonComponent],
    }),
  ],
  parameters: {
    componentSubtitle: 'Accessible notification/toast system with ARIA live regions',
    docs: {
      description: {
        component: `
The Notification component displays alerts, toasts, and notification dropdowns with full accessibility support.

## Features
- ✅ ARIA live regions for screen readers (role="alert", aria-live)
- ✅ Auto-dismiss with progress indicator
- ✅ Multiple types (info, success, warning, error, neutral)
- ✅ Toast positioning (top/bottom/left/right/center)
- ✅ Notification bell with dropdown menu
- ✅ Theme-aware with personality support
- ✅ Animations with reduced-motion support

## Migration Notice
**The old 'placement' input is deprecated.**
Use 'position' instead with more specific values:
- placement="top" → position="top-right"
- placement="bottom" → position="bottom-right"
- placement="left" → position="top-left"
- placement="right" → position="top-right"
        `,
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error', 'neutral'],
      description: 'Notification type',
    },
    position: {
      control: 'select',
      options: ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'],
      description: 'Toast position',
    },
    animation: {
      control: 'select',
      options: ['fade', 'slide', 'scale', 'none'],
      description: 'Animation style',
    },
    closable: {
      control: 'boolean',
      description: 'Show close button',
    },
    autoDismiss: {
      control: 'number',
      description: 'Auto-dismiss duration in ms (0 = no auto-dismiss)',
    },
    showProgress: {
      control: 'boolean',
      description: 'Show progress bar for auto-dismiss',
    },
  },
};
export default meta;
type Story = StoryObj<NotificationComponent>;

// ==================== SAMPLE DATA ====================

const sampleNotification: Notification = {
  id: '1',
  message: 'This is a sample notification message.',
  title: 'Notification Title',
  type: 'info',
  closable: true,
};

const sampleNotifications: Notification[] = [
  {
    id: '1',
    title: 'New Message',
    message: 'You have received a new message from John.',
    type: 'info',
    read: false,
  },
  {
    id: '2',
    title: 'Success!',
    message: 'Your changes have been saved successfully.',
    type: 'success',
    read: false,
  },
  {
    id: '3',
    title: 'Warning',
    message: 'Your subscription expires in 3 days.',
    type: 'warning',
    read: true,
  },
  {
    id: '4',
    title: 'Error',
    message: 'Failed to connect to the server.',
    type: 'error',
    read: true,
  },
];

// ==================== SINGLE TOAST EXAMPLES ====================

export const Info: Story = {
  args: {
    notification: sampleNotification,
    type: 'info',
    closable: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [closable]="closable"
        ></otui-notification>
      </div>
    `,
  }),
};

export const Success: Story = {
  args: {
    notification: { ...sampleNotification, type: 'success', title: 'Success!' },
    type: 'success',
    closable: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [closable]="closable"
        ></otui-notification>
      </div>
    `,
  }),
};

export const Warning: Story = {
  args: {
    notification: { ...sampleNotification, type: 'warning', title: 'Warning' },
    type: 'warning',
    closable: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [closable]="closable"
        ></otui-notification>
      </div>
    `,
  }),
};

export const Error: Story = {
  args: {
    notification: { ...sampleNotification, type: 'error', title: 'Error' },
    type: 'error',
    closable: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [closable]="closable"
        ></otui-notification>
      </div>
    `,
  }),
};

export const WithActions: Story = {
  args: {
    notification: {
      ...sampleNotification,
      type: 'info',
      actions: [
        { label: 'View', callback: () => console.log('View clicked') },
        { label: 'Dismiss', callback: () => console.log('Dismiss clicked'), variant: 'secondary' },
      ],
    },
    type: 'info',
    closable: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [closable]="closable"
        ></otui-notification>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Notifications can have action buttons for quick responses.',
      },
    },
  },
};

export const AutoDismiss: Story = {
  args: {
    notification: { ...sampleNotification, title: 'Auto-dismissing' },
    type: 'info',
    closable: true,
    autoDismiss: 5000,
    showProgress: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [closable]="closable"
          [autoDismiss]="autoDismiss"
          [showProgress]="showProgress"
        ></otui-notification>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'This notification will auto-dismiss after 5 seconds with a progress bar.',
      },
    },
  },
};

// ==================== ANIMATION EXAMPLES ====================

export const AnimationFade: Story = {
  args: {
    notification: { ...sampleNotification, title: 'Fade Animation' },
    type: 'info',
    animation: 'fade',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [animation]="animation"
        ></otui-notification>
      </div>
    `,
  }),
};

export const AnimationSlide: Story = {
  args: {
    notification: { ...sampleNotification, title: 'Slide Animation' },
    type: 'info',
    animation: 'slide',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [animation]="animation"
        ></otui-notification>
      </div>
    `,
  }),
};

export const AnimationScale: Story = {
  args: {
    notification: { ...sampleNotification, title: 'Scale Animation' },
    type: 'info',
    animation: 'scale',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [animation]="animation"
        ></otui-notification>
      </div>
    `,
  }),
};

// ==================== NOTIFICATION BELL ====================

export const NotificationBell: Story = {
  args: {
    notifications: sampleNotifications,
    showBell: true,
    showUnreadCount: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px; position: relative; height: 400px;">
        <div style="position: absolute; top: 24px; right: 24px;">
          <otui-notification
            [notifications]="notifications"
            [showBell]="showBell"
            [showUnreadCount]="showUnreadCount"
          ></otui-notification>
        </div>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'The notification bell shows unread count and opens a dropdown menu with all notifications.',
      },
    },
  },
};

// ==================== TOAST CONTAINER ====================

export const ToastContainer: Story = {
  args: {
    notifications: sampleNotifications.slice(0, 3),
    position: 'top-right',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px; position: relative; height: 400px; background: #f5f5f5;">
        <otui-notification
          [notifications]="notifications"
          [position]="position"
        ></otui-notification>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Toast notifications stack in a fixed position container.',
      },
    },
  },
};

// ==================== ACCESSIBILITY ====================

export const Accessibility: Story = {
  args: {
    notification: {
      id: 'a11y',
      title: 'Accessibility Features',
      message: 'This notification demonstrates accessibility support.',
      type: 'info',
    },
    type: 'info',
    ariaLive: 'polite',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px;">
        <otui-notification
          [notification]="notification"
          [type]="type"
          [ariaLive]="ariaLive"
        ></otui-notification>
        <div style="margin-top: 24px; padding: 16px; background: #f0f0f0; border-radius: 8px;">
          <h4>ARIA Features:</h4>
          <ul>
            <li>✅ role="alert" for screen readers</li>
            <li>✅ aria-live="polite" or "assertive"</li>
            <li>✅ aria-label for context</li>
            <li>✅ Focus management for interactive elements</li>
            <li>✅ Reduced motion support</li>
          </ul>
        </div>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Showcases accessibility features built into the notification component.',
      },
    },
  },
};

// ==================== LEGACY (Deprecated) ====================

export const LegacyPlacement: Story = {
  args: {
    notifications: sampleNotifications.slice(0, 2),
    placement: 'top',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="padding: 24px; position: relative; height: 300px; background: #f5f5f5;">
        <otui-notification
          [notifications]="notifications"
          [placement]="placement"
        ></otui-notification>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: `
**⚠️ DEPRECATED**

This uses the legacy 'placement' input. Use 'position' instead.
Check the browser console for deprecation warnings.
        `,
      },
    },
  },
};
