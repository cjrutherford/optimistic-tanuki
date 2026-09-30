import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from './button/button.component';
import { CardComponent } from './card/card.component';
import { TabsComponent } from './tabs/tabs.component';
import { SectionHeadingComponent } from './section-heading/section-heading.component';
import { ChipComponent } from './chip/chip.component';
import { BadgeComponent } from './badge.component';
import { TableComponent } from './table/table.component';

/**
 * A representative page for personality review: the surfaces the extension
 * layer touches (page ground + atmosphere, section band, tabs, cards, buttons,
 * chips, table, body and small text). Captured by
 * tools/personality-baseline for every personality x mode x primary; use the
 * Personality / Mode / Primary toolbar to browse it by hand.
 */
const meta: Meta = {
  title: 'Theme/Personality Review',
  decorators: [
    moduleMetadata({
      imports: [
        ButtonComponent,
        CardComponent,
        TabsComponent,
        SectionHeadingComponent,
        ChipComponent,
        BadgeComponent,
        TableComponent,
      ],
    }),
  ],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

export const Review: Story = {
  render: () => ({
    props: {
      tabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'activity', label: 'Activity', badge: 3 },
        { id: 'settings', label: 'Settings' },
      ],
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'status', header: 'Status' },
        { key: 'amount', header: 'Amount', align: 'right' },
      ],
      rows: [
        { name: 'Northwind order', status: 'Paid', amount: '$1,240.00' },
        { name: 'Contoso renewal', status: 'Pending', amount: '$860.50' },
        { name: 'Fabrikam invoice', status: 'Overdue', amount: '$2,015.75' },
      ],
    },
    template: `
      <div data-review-root style="min-height: 100vh; box-sizing: border-box; padding: 32px;
        background-color: var(--background); color: var(--foreground);
        background-image: var(--pattern-page, none), var(--page-background-pattern, none), var(--atmosphere-backdrop, none);
        background-size: var(--pattern-page-size, auto), auto, auto;
        font-family: var(--font-body, system-ui);">
        <div style="max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">
          <otui-section-heading eyebrow="Workspace" heading="Quarterly overview"
            subheading="How the personality shapes headings, bands and surfaces."></otui-section-heading>

          <otui-tabs [tabs]="tabs" activeTab="overview"></otui-tabs>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <otui-card>
              <h3 class="card-title">Revenue</h3>
              <p>Body text on a surface. Muted details sit below it and must stay readable in both modes.</p>
              <div style="display: flex; gap: 8px; margin-top: 12px;">
                <otui-badge tone="success">On track</otui-badge>
                <otui-chip>Q3</otui-chip>
              </div>
            </otui-card>
            <otui-card>
              <h3 class="card-title">Next steps</h3>
              <p>Primary, secondary and quiet actions on the same surface.</p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                <otui-button variant="primary">Primary</otui-button>
                <otui-button variant="secondary">Secondary</otui-button>
                <otui-button variant="outlined">Outlined</otui-button>
                <otui-button variant="text">Text</otui-button>
              </div>
            </otui-card>
          </div>

          <otui-table [columns]="columns" [data]="rows" caption="Recent invoices"></otui-table>

          <p style="margin: 0;">Page body text sits directly on the page ground.
            <small style="color: var(--muted-foreground, var(--foreground));">Small muted text for captions and hints.</small></p>
        </div>
      </div>
    `,
  }),
};
