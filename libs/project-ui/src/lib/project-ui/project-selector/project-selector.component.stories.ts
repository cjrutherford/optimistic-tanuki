import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectSelectorComponent } from './project-selector.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ProjectSelectorComponent> = {
  component: ProjectSelectorComponent,
  title: 'ProjectSelectorComponent',
};
export default meta;
type Story = StoryObj<ProjectSelectorComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/project-selector works!/gi)).toBeTruthy();
  },
};
