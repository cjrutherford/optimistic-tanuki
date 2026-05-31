import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { SectionHeadingComponent } from './section-heading.component';
import { ButtonComponent } from '../button/button.component';

/**
 * Themed section/page heading primitive: optional eyebrow + heading +
 * subheading + actions slot.
 *
 * Defaults derive from semantic theme tokens. The legacy `background`,
 * `padding`, `borderRadius`, and `color` inputs remain for back-compat with
 * pre-token apps and are exercised in the **LegacyInputs** story — new code
 * should drive appearance via CSS custom properties on the host instead.
 */
const meta: Meta<SectionHeadingComponent> = {
  component: SectionHeadingComponent,
  title: 'Primitives/SectionHeading',
  decorators: [
    moduleMetadata({
      imports: [CommonModule, SectionHeadingComponent, ButtonComponent],
    }),
  ],
  parameters: {
    componentSubtitle:
      'Page / section header with eyebrow, subheading, and actions slot.',
    docs: {
      description: {
        component: `
\`<otui-section-heading>\` renders a consistent page/section header across
every personality. The default \`<ng-content>\` slot accepts an actions row
(buttons, links, etc.) rendered alongside the heading.

## Inputs

| Input         | Notes                                            |
| ------------- | ------------------------------------------------ |
| \`eyebrow\`     | Small uppercase label above the heading.         |
| \`heading\`     | Main \`<h2>\` text.                                |
| \`subheading\`  | Optional supporting \`<h3>\` text.                 |
| \`background\`  | **Deprecated** — use CSS custom properties.      |
| \`padding\`     | **Deprecated** — use CSS custom properties.      |
| \`borderRadius\`| **Deprecated** — use CSS custom properties.      |
| \`color\`       | **Deprecated** — use CSS custom properties.      |

## Migration

Before:
\`\`\`html
<otui-section-heading
  heading="Dashboard"
  background="#0b1a2c"
  color="#ffffff"
  padding="2rem"
  borderRadius="16px"
></otui-section-heading>
\`\`\`

After:
\`\`\`html
<otui-section-heading heading="Dashboard" class="dashboard-hero"></otui-section-heading>
\`\`\`

\`\`\`scss
.dashboard-hero {
  --section-heading-background: color-mix(in oklab, var(--primary) 18%, var(--surface));
  --section-heading-color: var(--foreground);
  --section-heading-padding: 2rem;
  --section-heading-radius: 16px;
}
\`\`\`
        `,
      },
    },
  },
  argTypes: {
    eyebrow: { control: 'text' },
    heading: { control: 'text' },
    subheading: { control: 'text' },
    background: { control: 'text' },
    padding: { control: 'text' },
    borderRadius: { control: 'text' },
    color: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<SectionHeadingComponent>;

const wrap = (inner: string) => `
  <div style="display: grid; gap: 1rem; max-width: 720px;">
    ${inner}
  </div>
`;

// ==================== BASICS ====================

export const HeadingOnly: Story = {
  args: { heading: 'Dashboard' },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-section-heading [heading]="heading"></otui-section-heading>`
    ),
  }),
};

export const WithEyebrow: Story = {
  args: {
    eyebrow: 'Operations',
    heading: 'Service health',
  },
  render: (args) => ({
    props: args,
    template: wrap(`
      <otui-section-heading
        [eyebrow]="eyebrow"
        [heading]="heading"
      ></otui-section-heading>
    `),
  }),
};

export const WithSubheading: Story = {
  args: {
    heading: 'Recent activity',
    subheading: 'Updates from the last 24 hours across all projects.',
  },
  render: (args) => ({
    props: args,
    template: wrap(`
      <otui-section-heading
        [heading]="heading"
        [subheading]="subheading"
      ></otui-section-heading>
    `),
  }),
};

export const Full: Story = {
  args: {
    eyebrow: 'Q3 review',
    heading: 'Revenue overview',
    subheading: 'How the team performed against plan this quarter.',
  },
  render: (args) => ({
    props: args,
    template: wrap(`
      <otui-section-heading
        [eyebrow]="eyebrow"
        [heading]="heading"
        [subheading]="subheading"
      ></otui-section-heading>
    `),
  }),
};

// ==================== ACTIONS SLOT ====================

export const WithActions: Story = {
  render: () => ({
    template: wrap(`
      <otui-section-heading
        eyebrow="Library"
        heading="Components"
        subheading="Reusable primitives shared across every app."
      >
        <div style="display: inline-flex; gap: 0.5rem; margin-top: 0.75rem;">
          <otui-button>New component</otui-button>
          <otui-button variant="outlined">Import</otui-button>
        </div>
      </otui-section-heading>
    `),
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Project actions (buttons, links, filters) into the default `<ng-content>` slot to render them inside the heading container.',
      },
    },
  },
};

// ==================== TOKEN-DRIVEN OVERRIDE ====================

export const TokenOverride: Story = {
  render: () => ({
    template: `
      <style>
        .hero {
          --section-heading-background: color-mix(in oklab, var(--primary) 18%, var(--surface));
          --section-heading-color: var(--foreground);
          --section-heading-padding: 2rem;
          --section-heading-radius: 16px;
        }
      </style>
      <div style="display: grid; gap: 1rem; max-width: 720px;">
        <otui-section-heading
          class="hero"
          eyebrow="Welcome back"
          heading="Hello, Sam"
          subheading="Here is what is happening across your workspace today."
        ></otui-section-heading>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Prefer overriding the documented CSS custom properties on a host class rather than passing the legacy style inputs.',
      },
    },
  },
};

// ==================== LEGACY INPUTS (DEPRECATED) ====================

export const LegacyInputs: Story = {
  args: {
    eyebrow: 'Legacy',
    heading: 'Hard-coded styles',
    subheading: 'These inputs are retained for back-compat only.',
    background: 'linear-gradient(135deg, #1d2b4f, #0b1a2c)',
    color: '#ffffff',
    padding: '2rem',
    borderRadius: '16px',
  },
  render: (args) => ({
    props: args,
    template: wrap(`
      <otui-section-heading
        [eyebrow]="eyebrow"
        [heading]="heading"
        [subheading]="subheading"
        [background]="background"
        [color]="color"
        [padding]="padding"
        [borderRadius]="borderRadius"
      ></otui-section-heading>
    `),
  }),
  parameters: {
    docs: {
      description: {
        story:
          '**⚠️ Deprecated.** The `background`, `color`, `padding`, and `borderRadius` inputs bypass the token system and will not adapt to personality / mode toggles. Migrate to CSS custom properties — see the **TokenOverride** story.',
      },
    },
  },
};
