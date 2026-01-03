import type { Meta, StoryObj } from '@storybook/angular';
import { AiSummaryComponent } from './ai-summary.component';
import { within, expect } from 'storybook/internal/test';


const meta: Meta<AiSummaryComponent> = {
  component: AiSummaryComponent,
  title: 'AiSummaryComponent',
};
export default meta;
type Story = StoryObj<AiSummaryComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/ai-summary works!/gi)).toBeTruthy();
  },
};
