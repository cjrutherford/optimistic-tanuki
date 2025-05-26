import type { Meta, StoryObj } from '@storybook/angular';
import { FeedComponent } from './feed.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<FeedComponent> = {
  component: FeedComponent,
  title: 'FeedComponent',
};
export default meta;
type Story = StoryObj<FeedComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/feed works!/gi)).toBeTruthy();
  },
};
