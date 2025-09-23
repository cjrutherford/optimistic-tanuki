import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectUiComponent } from './project-ui.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ProjectUiComponent> = {
  component: ProjectUiComponent,
  title: 'ProjectUiComponent',
};
export default meta;
type Story = StoryObj<ProjectUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/project-ui works!/gi)).toBeTruthy();
  },
};
