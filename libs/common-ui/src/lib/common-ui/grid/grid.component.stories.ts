import { GridComponent } from './grid.component';
import { TileComponent } from '../tile/tile.component'; // Import TileComponent
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<GridComponent> = {
  component: GridComponent,
  title: 'GridComponent',
  decorators: [
    moduleMetadata({
      imports: [TileComponent],
    }),
  ],
};
export default meta;
type Story = StoryObj<GridComponent>;

export const Primary: Story = {
  args: {
    columns: 3,
    rows: 2,
  },
  render: () => ({
    template: `
      <otui-grid [columns]="3" [rows]="2">
        <otui-tile>Tile 1</otui-tile>
        <otui-tile>Tile 2</otui-tile>
        <otui-tile>Tile 3</otui-tile>
        <otui-tile>Tile 4</otui-tile>
        <otui-tile>Tile 5</otui-tile>
        <otui-tile>Tile 6</otui-tile>
      </otui-grid>
    `,
  }),
};

export const Secondary: Story = {
  args: {
    columns: 4,
    rows: 1,
  },
  render: () => ({
    template: `
      <otui-grid [columns]="4" [rows]="1">
        <otui-tile>Tile A</otui-tile>
        <otui-tile>Tile B</otui-tile>
        <otui-tile>Tile C</otui-tile>
        <otui-tile>Tile D</otui-tile>
      </otui-grid>
    `,
  }),
};

export const Tertiary: Story = {
  args: {
    columns: 2,
    rows: 3,
  },
  render: () => ({
    template: `
      <otui-grid [columns]="2" [rows]="3">
        <otui-tile>Tile X</otui-tile>
        <otui-tile>Tile Y</otui-tile>
        <otui-tile>Tile Z</otui-tile>
        <otui-tile>Tile W</otui-tile>
        <otui-tile>Tile V</otui-tile>
        <otui-tile>Tile U</otui-tile>
      </otui-grid>
    `,
  }),
};

export const Heading: Story = {
  args: {
    columns: 3,
    rows: 2,
  },
  render: () => ({
    template: `
      <otui-grid [columns]="3" [rows]="2">
        <otui-tile>Tile 1</otui-tile>
        <otui-tile>Tile 2</otui-tile>
        <otui-tile>Tile 3</otui-tile>
        <otui-tile>Tile 4</otui-tile>
        <otui-tile>Tile 5</otui-tile>
        <otui-tile>Tile 6</otui-tile>
      </otui-grid>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Tile 1/gi)).toBeTruthy();
  },
};

export const LightMode: Story = {
  args: {
    columns: 3,
    rows: 2,
  },
  render: () => ({
    template: `
      <otui-grid [columns]="3" [rows]="2" class="light-mode">
        <otui-tile>Tile 1</otui-tile>
        <otui-tile>Tile 2</otui-tile>
        <otui-tile>Tile 3</otui-tile>
        <otui-tile>Tile 4</otui-tile>
        <otui-tile>Tile 5</otui-tile>
        <otui-tile>Tile 6</otui-tile>
      </otui-grid>
    `,
  }),
};

export const DarkMode: Story = {
  args: {
    columns: 3,
    rows: 2,
  },
  render: () => ({
    template: `
      <otui-grid [columns]="3" [rows]="2" class="dark-mode">
        <otui-tile>Tile 1</otui-tile>
        <otui-tile>Tile 2</otui-tile>
        <otui-tile>Tile 3</otui-tile>
        <otui-tile>Tile 4</otui-tile>
        <otui-tile>Tile 5</otui-tile>
        <otui-tile>Tile 6</otui-tile>
      </otui-grid>
    `,
  }),
};

export const FastCycleMode: Story = {
  args: {
    columns: 3,
    rows: 2,
  },
  render: () => ({
    template: `
      <otui-grid [columns]="3" [rows]="2" class="fast-cycle-mode">
        <otui-tile>Tile 1</otui-tile>
        <otui-tile>Tile 2</otui-tile>
        <otui-tile>Tile 3</otui-tile>
        <otui-tile>Tile 4</otui-tile>
        <otui-tile>Tile 5</otui-tile>
        <otui-tile>Tile 6</otui-tile>
      </otui-grid>
    `,
  }),
};
