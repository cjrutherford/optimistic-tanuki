import type { Meta, StoryObj } from '@storybook/angular';
import { ChangesTableComponent } from './changes-table.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ChangesTableComponent> = {
  component: ChangesTableComponent,
  title: 'ChangesTableComponent',
};
export default meta;
type Story = StoryObj<ChangesTableComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/changes-table works!/gi)).toBeTruthy();
  },
};
