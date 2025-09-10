import type { Meta, StoryObj } from '@storybook/angular';
import { HeroComponent } from './hero.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<HeroComponent> = {
  component: HeroComponent,
  title: 'HeroComponent',
};
export default meta;
type Story = StoryObj<HeroComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/hero works!/gi)).toBeTruthy();
  },
};
