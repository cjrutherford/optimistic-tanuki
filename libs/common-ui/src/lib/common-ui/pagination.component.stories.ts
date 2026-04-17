import type { Meta, StoryObj } from '@storybook/angular';
import { PaginationComponent } from './pagination.component';
import { expect, within } from '@storybook/test';

const meta: Meta<PaginationComponent> = {
  component: PaginationComponent,
  title: 'PaginationComponent',
  args: {
    totalItems: 100,
    itemsPerPage: 10,
    currentPage: 1,
    maxVisiblePages: 5,
  },
};
export default meta;
type Story = StoryObj<PaginationComponent>;

export const Primary: Story = {
  args: {
    totalItems: 100,
    itemsPerPage: 10,
    currentPage: 1,
    maxVisiblePages: 5,
  },
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/pagination works!/gi)).toBeTruthy();
  },
};
