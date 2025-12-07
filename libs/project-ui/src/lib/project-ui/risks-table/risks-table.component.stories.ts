import type { Meta, StoryObj } from '@storybook/angular';
import { RisksTableComponent } from './risks-table.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

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
