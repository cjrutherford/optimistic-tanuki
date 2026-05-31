import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { CommonModule } from '@angular/common';
import { MetricTileComponent } from './metric-tile.component';

/**
 * Themed metric tile primitive: label / value / optional delta + sparkline slot.
 *
 * All colors derive from semantic theme tokens (`--surface`, `--foreground`,
 * `--border`, `--muted-foreground`, `--success`, `--danger`). Use the toolbar
 * Personality and Mode controls to verify the tile under every persona /
 * light+dark pairing — no hard-coded hex values should appear.
 */
const meta: Meta<MetricTileComponent> = {
  component: MetricTileComponent,
  title: 'Primitives/MetricTile',
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
  parameters: {
    componentSubtitle:
      'KPI / metric primitive with delta direction, tone, and sparkline slot.',
    docs: {
      description: {
        component: `
The \`MetricTileComponent\` (\`otui-metric-tile\`) renders a single KPI tile composed
of a label, a value, and an optional delta + caption row. A \`<ng-content>\`
slot under the value accepts an inline sparkline (SVG, canvas, or any custom
chart element).

## Inputs

| Input            | Type                                      | Notes                                           |
| ---------------- | ----------------------------------------- | ----------------------------------------------- |
| \`label\`          | \`string\`                                  | Uppercase eyebrow label.                        |
| \`value\`          | \`string \\| number\`                        | Primary metric value (tabular-nums).            |
| \`caption\`        | \`string?\`                                 | Optional context line (e.g. "vs last week").    |
| \`delta\`          | \`string?\`                                 | Pre-formatted delta (e.g. \`"+12.4%"\`).          |
| \`deltaDirection\` | \`'up' \\| 'down' \\| 'flat'\`                | Drives arrow glyph + default tone.              |
| \`deltaTone\`      | \`'neutral' \\| 'positive' \\| 'negative'?\`  | Override tone when direction ≠ sentiment.       |

## Theming

The component reads only semantic tokens, so it inherits the active theme
without any per-personality overrides. Use the Storybook **Personality** and
**Mode** toolbar controls to confirm contrast in every preset.

### Token overrides

If a host app needs to tweak a single tile (e.g. a hero KPI), override the
local custom properties on a wrapper:

\`\`\`scss
.hero-kpi {
  --metric-tile-padding: 1.5rem 2rem;
  --metric-tile-radius: 20px;
  --metric-tile-background: color-mix(in oklab, var(--primary) 12%, var(--surface));
}
\`\`\`
        `,
      },
    },
  },
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    caption: { control: 'text' },
    delta: { control: 'text' },
    deltaDirection: {
      control: 'inline-radio',
      options: ['up', 'down', 'flat'],
    },
    deltaTone: {
      control: 'inline-radio',
      options: [undefined, 'neutral', 'positive', 'negative'],
    },
  },
};
export default meta;
type Story = StoryObj<MetricTileComponent>;

const wrap = (inner: string) => `
  <div style="display: grid; gap: 1rem; max-width: 320px;">
    ${inner}
  </div>
`;

// ==================== BASICS ====================

export const ValueOnly: Story = {
  args: {
    label: 'Active users',
    value: '12,480',
  },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-metric-tile [label]="label" [value]="value"></otui-metric-tile>`
    ),
  }),
};

export const WithCaption: Story = {
  args: {
    label: 'Revenue',
    value: '$48.2k',
    caption: 'vs last week',
  },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-metric-tile
         [label]="label"
         [value]="value"
         [caption]="caption">
       </otui-metric-tile>`
    ),
  }),
};

// ==================== DELTA DIRECTIONS ====================

export const DeltaUp: Story = {
  args: {
    label: 'Signups',
    value: 1284,
    delta: '+12.4%',
    deltaDirection: 'up',
    caption: 'vs last week',
  },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-metric-tile
         [label]="label"
         [value]="value"
         [delta]="delta"
         [deltaDirection]="deltaDirection"
         [caption]="caption">
       </otui-metric-tile>`
    ),
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Upward delta resolves to `--success`. Default tone is `positive`.',
      },
    },
  },
};

export const DeltaDown: Story = {
  args: {
    label: 'Bounce rate',
    value: '38%',
    delta: '-4.1%',
    deltaDirection: 'down',
    caption: 'vs last week',
  },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-metric-tile
         [label]="label"
         [value]="value"
         [delta]="delta"
         [deltaDirection]="deltaDirection"
         [caption]="caption">
       </otui-metric-tile>`
    ),
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Downward delta resolves to `--danger`. Default tone is `negative`.',
      },
    },
  },
};

export const DeltaFlat: Story = {
  args: {
    label: 'Avg session',
    value: '4m 12s',
    delta: '0.0%',
    deltaDirection: 'flat',
    caption: 'vs last week',
  },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-metric-tile
         [label]="label"
         [value]="value"
         [delta]="delta"
         [deltaDirection]="deltaDirection"
         [caption]="caption">
       </otui-metric-tile>`
    ),
  }),
  parameters: {
    docs: {
      description: {
        story: 'Flat delta resolves to `--muted-foreground` (neutral tone).',
      },
    },
  },
};

// ==================== TONE OVERRIDE ====================

export const ToneOverrideUpIsBad: Story = {
  args: {
    label: 'Error rate',
    value: '2.3%',
    delta: '+0.8pp',
    deltaDirection: 'up',
    deltaTone: 'negative',
    caption: 'vs last week',
  },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-metric-tile
         [label]="label"
         [value]="value"
         [delta]="delta"
         [deltaDirection]="deltaDirection"
         [deltaTone]="deltaTone"
         [caption]="caption">
       </otui-metric-tile>`
    ),
  }),
  parameters: {
    docs: {
      description: {
        story:
          'When the metric semantically inverts direction (e.g. error rate going up is bad), pass `deltaTone="negative"` explicitly to override the directional default.',
      },
    },
  },
};

export const ToneOverrideDownIsGood: Story = {
  args: {
    label: 'Page weight',
    value: '184 KB',
    delta: '-22 KB',
    deltaDirection: 'down',
    deltaTone: 'positive',
    caption: 'vs last release',
  },
  render: (args) => ({
    props: args,
    template: wrap(
      `<otui-metric-tile
         [label]="label"
         [value]="value"
         [delta]="delta"
         [deltaDirection]="deltaDirection"
         [deltaTone]="deltaTone"
         [caption]="caption">
       </otui-metric-tile>`
    ),
  }),
};

// ==================== SPARKLINE SLOT ====================

const sparkline = `
  <svg
    viewBox="0 0 120 36"
    preserveAspectRatio="none"
    aria-hidden="true"
    style="width: 100%; height: 36px; display: block;"
  >
    <polyline
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      points="0,28 12,22 24,24 36,18 48,20 60,12 72,16 84,8 96,12 108,6 120,10"
    />
  </svg>
`;

export const WithSparkline: Story = {
  args: {
    label: 'Throughput',
    value: '1.42k/s',
    delta: '+6.1%',
    deltaDirection: 'up',
    caption: 'last 24h',
  },
  render: (args) => ({
    props: args,
    template: wrap(`
      <otui-metric-tile
        [label]="label"
        [value]="value"
        [delta]="delta"
        [deltaDirection]="deltaDirection"
        [caption]="caption"
      >
        ${sparkline}
      </otui-metric-tile>
    `),
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Project an inline sparkline via the default `<ng-content>` slot. Use `currentColor` on the stroke so it inherits the tile foreground under every personality.',
      },
    },
  },
};

// ==================== GRID PREVIEW ====================

export const KpiGrid: Story = {
  render: () => ({
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; max-width: 960px;">
        <otui-metric-tile
          label="Active users"
          value="12,480"
          delta="+12.4%"
          deltaDirection="up"
          caption="vs last week"
        ></otui-metric-tile>
        <otui-metric-tile
          label="Revenue"
          value="$48.2k"
          delta="+3.1%"
          deltaDirection="up"
          caption="vs last week"
        ></otui-metric-tile>
        <otui-metric-tile
          label="Bounce rate"
          value="38%"
          delta="-4.1%"
          deltaDirection="down"
          caption="vs last week"
        ></otui-metric-tile>
        <otui-metric-tile
          label="Error rate"
          value="2.3%"
          delta="+0.8pp"
          deltaDirection="up"
          [deltaTone]="'negative'"
          caption="vs last week"
        ></otui-metric-tile>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Realistic dashboard layout. Toggle the Personality and Mode toolbar controls to verify contrast across every theme.',
      },
    },
  },
};
