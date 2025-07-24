import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectOverviewComponent } from './project-overview.component';
import { within } from '@storybook/testing-library';
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
    expect(canvas.getByText(/project-overview works!/gi)).toBeTruthy();
  },
};
