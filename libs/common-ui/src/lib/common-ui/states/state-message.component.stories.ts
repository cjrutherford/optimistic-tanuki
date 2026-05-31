import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { StateMessageComponent } from './state-message.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingStateComponent,
} from './index';
import { ButtonComponent } from '../button/button.component';

/**
 * Generic state-message primitive plus the three convenience wrappers
 * (`<otui-empty-state>`, `<otui-loading-state>`, `<otui-error-state>`).
 *
 * All variants pull from semantic theme tokens; the `data-kind` and
 * `data-tone` attributes drive accent color, icon shape, and ARIA semantics
 * (`role="alert"` + `aria-live="assertive"` for the error kind, otherwise
 * `role="status"` + `aria-live="polite"`).
 */
const meta: Meta<StateMessageComponent> = {
  component: StateMessageComponent,
  title: 'Primitives/StateMessage',
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        StateMessageComponent,
        EmptyStateComponent,
        LoadingStateComponent,
        ErrorStateComponent,
        ButtonComponent,
      ],
    }),
  ],
  parameters: {
    componentSubtitle:
      'Empty / loading / error / generic state messaging with accessible live regions.',
    docs: {
      description: {
        component: `
\`<otui-state-message>\` is the low-level primitive. Most apps should reach
for one of the three pre-configured wrappers:

| Wrapper                  | \`kind\`     | Default \`tone\` | Default glyph |
| ------------------------ | ----------- | -------------- | ------------- |
| \`<otui-empty-state>\`     | \`empty\`    | \`neutral\`     | ✨             |
| \`<otui-loading-state>\`   | \`loading\`  | \`info\`        | ●             |
| \`<otui-error-state>\`     | \`error\`    | \`danger\`      | ⚠             |

## Slots

| Slot                | Purpose                                  |
| ------------------- | ---------------------------------------- |
| \`[slot=icon]\`       | Custom icon (overrides \`iconGlyph\`).     |
| \`[slot=actions]\`    | Action row (typically \`<otui-button>\`).  |
| Default \`<ng-content>\` | Free-form body content below the actions row. |

## Accessibility

- \`kind="error"\` emits \`role="alert"\` + \`aria-live="assertive"\`.
- All other kinds emit \`role="status"\` + \`aria-live="polite"\`.
- The icon container is \`aria-hidden\` — supply textual context via
  \`headline\` and \`body\`.
        `,
      },
    },
  },
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['empty', 'loading', 'error', 'generic'],
    },
    tone: {
      control: 'inline-radio',
      options: ['neutral', 'info', 'success', 'warning', 'danger'],
    },
    headline: { control: 'text' },
    body: { control: 'text' },
    iconGlyph: { control: 'text' },
    hideIcon: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<StateMessageComponent>;

const wrap = (inner: string) => `
  <div style="display: grid; gap: 1rem; max-width: 480px;">
    ${inner}
  </div>
`;

// ==================== KIND × TONE GALLERY ====================

export const Empty: Story = {
  render: () => ({
    template: wrap(`
      <otui-empty-state
        headline="No projects yet"
        body="Create your first project to get started."
      >
        <otui-button slot="actions">New project</otui-button>
      </otui-empty-state>
    `),
  }),
};

export const Loading: Story = {
  render: () => ({
    template: wrap(`
      <otui-loading-state
        headline="Loading dashboard…"
        body="Hang tight while we fetch the latest data."
      ></otui-loading-state>
    `),
  }),
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => ({
    template: wrap(`
      <otui-error-state
        headline="Could not load posts"
        body="Check your connection and try again."
      >
        <otui-button slot="actions">Retry</otui-button>
      </otui-error-state>
    `),
  }),
};

// ==================== TONE MATRIX ====================

export const AllTones: Story = {
  render: () => ({
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; max-width: 960px;">
        <otui-state-message
          kind="generic"
          tone="neutral"
          headline="Neutral"
          body="Default messaging."
          iconGlyph="•"
        ></otui-state-message>
        <otui-state-message
          kind="generic"
          tone="info"
          headline="Info"
          body="Informational context."
          iconGlyph="i"
        ></otui-state-message>
        <otui-state-message
          kind="generic"
          tone="success"
          headline="Success"
          body="Operation completed."
          iconGlyph="✓"
        ></otui-state-message>
        <otui-state-message
          kind="generic"
          tone="warning"
          headline="Warning"
          body="Something to watch out for."
          iconGlyph="!"
        ></otui-state-message>
        <otui-state-message
          kind="generic"
          tone="danger"
          headline="Danger"
          body="Action required."
          iconGlyph="⚠"
        ></otui-state-message>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Tone is independent from kind — useful for the generic kind when you need a colored callout that is not an alert.',
      },
    },
  },
};

// ==================== HEADLINE-ONLY ====================

export const HeadlineOnly: Story = {
  args: {
    kind: 'generic',
    tone: 'neutral',
    headline: 'No results found',
  },
  render: (args) => ({
    props: args,
    template: wrap(`
      <otui-state-message
        [kind]="kind"
        [tone]="tone"
        [headline]="headline"
      ></otui-state-message>
    `),
  }),
};

// ==================== CUSTOM ICON SLOT ====================

export const CustomIconSlot: Story = {
  render: () => ({
    template: wrap(`
      <otui-empty-state headline="Inbox zero" body="You're all caught up.">
        <svg
          slot="icon"
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
        </svg>
        <otui-button slot="actions" variant="outlined">Compose</otui-button>
      </otui-empty-state>
    `),
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Project any element into `[slot=icon]` to replace the default glyph. Use `currentColor` on strokes/fills so the icon inherits the active tone.',
      },
    },
  },
};

// ==================== ACTIONS ROW ====================

export const WithMultipleActions: Story = {
  render: () => ({
    template: wrap(`
      <otui-error-state
        headline="Sync failed"
        body="We could not reach the server."
      >
        <otui-button slot="actions">Retry</otui-button>
        <otui-button slot="actions" variant="outlined">Cancel</otui-button>
      </otui-error-state>
    `),
  }),
};

// ==================== HIDDEN ICON ====================

export const HiddenIcon: Story = {
  args: {
    kind: 'generic',
    tone: 'info',
    headline: 'Heads up',
    body: 'Icon area suppressed for compact layouts.',
    hideIcon: true,
  },
  render: (args) => ({
    props: args,
    template: wrap(`
      <otui-state-message
        [kind]="kind"
        [tone]="tone"
        [headline]="headline"
        [body]="body"
        [hideIcon]="hideIcon"
      ></otui-state-message>
    `),
  }),
};
