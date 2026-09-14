import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalityBackdropComponent } from './personality-backdrop.component';

const meta: Meta<PersonalityBackdropComponent> = {
  component: PersonalityBackdropComponent,
  title: 'Personality Backdrop',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The fixed page-background layer apps place once in their root template. Personalities with a page pattern (switch the Personality toolbar) show it behind the content.',
      },
    },
  },
  render: () => ({
    template: `
      <div style="position: relative; min-height: 420px; isolation: isolate">
        <lib-personality-backdrop />
        <div style="position: relative; max-width: 560px; margin: 48px auto; padding: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--personality-card-radius)">
          <h2 style="margin-top: 0">Content above the backdrop</h2>
          <p>The backdrop sits behind app content and fades in once the personality is applied.</p>
        </div>
      </div>`,
  }),
};

export default meta;
type Story = StoryObj<PersonalityBackdropComponent>;

export const Default: Story = {};
