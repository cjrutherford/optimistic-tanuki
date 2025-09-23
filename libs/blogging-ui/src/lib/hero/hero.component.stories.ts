import type { Meta, StoryObj } from '@storybook/angular';
import { HeroComponent } from './hero.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<HeroComponent> = {
  component: HeroComponent,
  title: 'HeroComponent',
};
export default meta;
type Story = StoryObj<HeroComponent>;

export const Primary: Story = {
  args: {
    imageUrl: 'https://picsum.photos/1200/300',
  },
};

export const Heading: Story = {
  args: {
    imageUrl: 'https://picsum.photos/1200/300',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/hero works!/gi)).toBeTruthy();
  },
};
