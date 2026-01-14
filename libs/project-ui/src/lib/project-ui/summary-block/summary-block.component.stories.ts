import type { Meta, StoryObj } from '@storybook/angular';
import { SummaryBlockComponent } from './summary-block.component';
import { within, expect } from 'storybook/internal/test';

const meta: Meta<SummaryBlockComponent> = {
  component: SummaryBlockComponent,
  title: 'SummaryBlockComponent',
};
export default meta;
type Story = StoryObj<SummaryBlockComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/summary-block works!/gi)).toBeTruthy();
  },
};
