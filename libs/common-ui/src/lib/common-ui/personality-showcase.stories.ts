import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button/button.component';

const meta: Meta<ButtonComponent> = {
  component: ButtonComponent,
  title: 'Theme/Personality Showcase',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<ButtonComponent>;

const template = {
  template: `
    <div style="display: flex; flex-direction: column; gap: 24px; padding: 32px; min-width: 400px; background: var(--background, #fff); color: var(--foreground, #000); border-radius: 8px;">
      <div style="display: flex; gap: 12px;">
        <otui-button variant="primary">Primary</otui-button>
        <otui-button variant="secondary">Secondary</otui-button>
        <otui-button variant="outlined">Outlined</otui-button>
        <otui-button variant="text">Text</otui-button>
      </div>
      <div style="display: flex; gap: 12px;">
        <otui-button variant="success">Success</otui-button>
        <otui-button variant="danger">Danger</otui-button>
        <otui-button variant="warning">Warning</otui-button>
      </div>
      <div style="display: flex; gap: 12px;">
        <otui-button variant="primary" disabled>Disabled</otui-button>
      </div>
      <div style="font-family: var(--font-body, system-ui); font-size: 14px;">
        Sample text with the personality's font and colors.
      </div>
    </div>
  `,
};

export const Showcase: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 32px; min-width: 400px; background: var(--background, #fff); color: var(--foreground, #000); border-radius: 8px;">
        <div style="display: flex; gap: 12px;">
          <otui-button variant="primary">Primary</otui-button>
          <otui-button variant="secondary">Secondary</otui-button>
          <otui-button variant="outlined">Outlined</otui-button>
          <otui-button variant="text">Text</otui-button>
        </div>
        <div style="display: flex; gap: 12px;">
          <otui-button variant="success">Success</otui-button>
          <otui-button variant="danger">Danger</otui-button>
          <otui-button variant="warning">Warning</otui-button>
        </div>
        <div style="display: flex; gap: 12px;">
          <otui-button variant="primary" disabled>Disabled</otui-button>
        </div>
        <div style="font-family: var(--font-body, system-ui); font-size: 14px;">
          Sample text with the personality's font and colors.
        </div>
      </div>
    `,
  }),
};
