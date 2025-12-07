import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectJournalTableComponent } from './project-journal-table.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ProjectJournalTableComponent> = {
  component: ProjectJournalTableComponent,
  title: 'ProjectJournalTableComponent',
};
export default meta;
type Story = StoryObj<ProjectJournalTableComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/project-journal-table works!/gi)).toBeTruthy();
  },
};
