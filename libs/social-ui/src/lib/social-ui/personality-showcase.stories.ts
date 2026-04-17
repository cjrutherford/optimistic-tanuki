import type { Meta, StoryObj } from '@storybook/angular';
import { SocialUiComponent } from './social-ui.component';

const meta: Meta<SocialUiComponent> = {
  component: SocialUiComponent,
  title: 'Theme/Personality Showcase',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<SocialUiComponent>;

export const Showcase: Story = {
  render: () => ({
    template: `
      <div style="padding: 48px; min-width: 400px; background: var(--background, #fff); color: var(--foreground, #000); border-radius: 8px; box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1));">
        <h2 style="font-family: var(--font-heading, system-ui); margin-bottom: 24px;">Personality Showcase</h2>
        <p style="margin-bottom: 24px; font-family: var(--font-body, system-ui);">
          Use the toolbar above to switch between personalities and color modes.
        </p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button style="padding: 10px 20px; background: var(--accent, #3f51b5); color: white; border: none; border-radius: var(--border-radius-md, 4px); font-family: var(--font-body, system-ui); cursor: pointer;">Primary</button>
          <button style="padding: 10px 20px; background: transparent; color: var(--accent, #3f51b5); border: 1px solid var(--border, #ccc); border-radius: var(--border-radius-md, 4px); font-family: var(--font-body, system-ui); cursor: pointer;">Secondary</button>
        </div>
      </div>
    `,
  }),
};
