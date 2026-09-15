import type { Meta, StoryObj } from '@storybook/angular';
import { FinanceWorkspaceScreenComponent } from './finance-workspace-screen.component';

const meta: Meta<FinanceWorkspaceScreenComponent> = {
  component: FinanceWorkspaceScreenComponent,
  title: 'Workspace Screen',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'Personal workspace',
    title: 'Budgets',
    lede: 'Set limits per category and see where the month is heading.',
    status: '',
  },
  render: (args) => ({
    props: args,
    template: `
      <ot-finance-workspace-screen [eyebrow]="eyebrow" [title]="title" [lede]="lede" [status]="status">
        <div style="padding: var(--spacing-lg); border: 1px dashed var(--border); border-radius: var(--border-radius-md); color: var(--muted)">
          Screen content
        </div>
      </ot-finance-workspace-screen>`,
  }),
};

export default meta;
type Story = StoryObj<FinanceWorkspaceScreenComponent>;

export const Default: Story = {};
export const WithStatus: Story = { args: { status: 'Synced 5 minutes ago' } };
