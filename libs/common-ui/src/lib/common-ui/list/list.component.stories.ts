import type { Meta, StoryObj } from '@storybook/angular';
import { ListComponent } from './list.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ListComponent> = {
  component: ListComponent,
  title: 'ListComponent',
};
export default meta;
type Story = StoryObj<ListComponent>;

export const Primary: Story = {
  args: {
    items: [],
    type: 'bullet',
  },
};

export const Heading: Story = {
  args: {
    items: [],
    type: 'bullet',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/list works!/gi)).toBeTruthy();
  },
};
