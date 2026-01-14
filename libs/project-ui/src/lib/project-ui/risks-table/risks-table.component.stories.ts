import type { Meta, StoryObj } from '@storybook/angular';
import { RisksTableComponent } from './risks-table.component';
import { within, expect } from 'storybook/internal/test';

const meta: Meta<RisksTableComponent> = {
  component: RisksTableComponent,
  title: 'RisksTableComponent',
};
export default meta;
type Story = StoryObj<RisksTableComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/risks-table works!/gi)).toBeTruthy();
  },
};
