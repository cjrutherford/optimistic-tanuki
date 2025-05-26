import type { Meta, StoryObj } from '@storybook/angular';
import { TileComponent } from './tile.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<TileComponent> = {
  component: TileComponent,
  title: 'TileComponent',
};
export default meta;
type Story = StoryObj<TileComponent>;

export const Primary: Story = {
  render: () => ({
    template: `
      <otui-tile>Primary Tile</otui-tile>
    `,
  }),
};

export const Secondary: Story = {
  render: () => ({
    template: `
      <otui-tile>Secondary Tile</otui-tile>
    `,
  }),
};

export const Tertiary: Story = {
  render: () => ({
    template: `
      <otui-tile>Tertiary Tile</otui-tile>
    `,
  }),
};

export const Heading: Story = {
  render: () => ({
    template: `
      <otui-tile>Heading Tile</otui-tile>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Heading Tile/gi)).toBeTruthy();
  },
};

export const LightMode: Story = {
  render: () => ({
    template: `
      <otui-tile class="light-mode">Light Mode Tile</otui-tile>
    `,
  }),
};

export const DarkMode: Story = {
  render: () => ({
    template: `
      <otui-tile class="dark-mode">Dark Mode Tile</otui-tile>
    `,
  }),
};

export const FastCycleMode: Story = {
  render: () => ({
    template: `
      <otui-tile class="fast-cycle-mode">Fast Cycle Mode Tile</otui-tile>
    `,
  }),
};
