import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectOverviewComponent } from './project-overview.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ProjectOverviewComponent> = {
  component: ProjectOverviewComponent,
  title: 'ProjectOverviewComponent',
};
export default meta;
type Story = StoryObj<ProjectOverviewComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/project-overview works!/gi)).toBeTruthy();
  },
};
