import type { Meta, StoryObj } from '@storybook/angular';
import { RiskFormComponent } from './risk-form.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<RiskFormComponent> = {
  component: RiskFormComponent,
  title: 'RiskFormComponent',
};
export default meta;
type Story = StoryObj<RiskFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/risk-form works!/gi)).toBeTruthy();
  },
};
