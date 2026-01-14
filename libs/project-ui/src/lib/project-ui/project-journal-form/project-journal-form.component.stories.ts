import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectJournalFormComponent } from './project-journal-form.component';
import { within, expect } from 'storybook/internal/test';

const meta: Meta<ProjectJournalFormComponent> = {
  component: ProjectJournalFormComponent,
  title: 'ProjectJournalFormComponent',
};
export default meta;
type Story = StoryObj<ProjectJournalFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/project-journal-form works!/gi)
    ).toBeTruthy();
  },
};
