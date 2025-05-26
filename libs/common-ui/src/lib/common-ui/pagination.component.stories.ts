import type { Meta, StoryObj } from '@storybook/angular';
import { PaginationComponent } from './pagination.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<PaginationComponent> = {
  component: PaginationComponent,
  title: 'PaginationComponent',
  args: {
    totalPages: 20,
    currentPage: 1,
    maxVisiblePages: 5,
  },
};
export default meta;
type Story = StoryObj<PaginationComponent>;

export const Primary: Story = {
  args: {
    totalPages: 20,
    currentPage: 1,
    maxVisiblePages: 5,
  },
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/pagination works!/gi)).toBeTruthy();
  },
};
