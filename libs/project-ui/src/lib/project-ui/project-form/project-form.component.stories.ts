import type { Meta, StoryObj } from '@storybook/angular';
import { ProjectFormComponent } from './project-form.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ProjectFormComponent> = {
  component: ProjectFormComponent,
  title: 'ProjectFormComponent',
};
export default meta;
type Story = StoryObj<ProjectFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/project-form works!/gi)).toBeTruthy();
  },
};
