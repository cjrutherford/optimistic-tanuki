import type { Meta, StoryObj } from '@storybook/angular';
import { VoteComponent } from './vote.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<VoteComponent> = {
  component: VoteComponent,
  title: 'VoteComponent',
};
export default meta;
type Story = StoryObj<VoteComponent>;

export const Default: Story = {
  args: {},
};

export const Upvoted: Story = {
  args: {
    voteState: 1,
  },
};

export const Downvoted: Story = {
  args: {
    voteState: -1,
  },
};

export const Cancelled: Story = {
  args: {
    voteState: 0,
  },
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/vote works!/gi)).toBeTruthy();
  },
};
