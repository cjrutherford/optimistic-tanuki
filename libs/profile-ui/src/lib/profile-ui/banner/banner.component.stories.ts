import type { Meta, StoryObj } from '@storybook/angular';
import { BannerComponent } from './banner.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<BannerComponent> = {
  component: BannerComponent,
  title: 'BannerComponent',
};
export default meta;
type Story = StoryObj<BannerComponent>;

export const Primary: Story = {
  args: {
    profileName: 'John Doe',
    profileImage:
      'https://pics.craiyon.com/2025-03-08/hk2UObNST0a0srW-lcG9jg.webp',
    backgroundImage:
      'https://pics.craiyon.com/2024-09-03/hIBoUeS-RzS_7_l7acYhgA.webp',
  },
};

export const Secondary: Story = {
  args: {
    profileName: 'Jane Smith',
    profileImage: 'https://placehold.co/100x100',
    backgroundImage: 'https://placehold.co/800x200',
  },
};

export const Heading: Story = {
  args: {
    profileName: 'Banner Heading',
    profileImage: 'https://placehold.co/100x100',
    backgroundImage: 'https://placehold.co/800x200',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Banner Heading/gi)).toBeTruthy();
  },
};
