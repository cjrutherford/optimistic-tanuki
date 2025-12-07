import type { Meta, StoryObj } from '@storybook/angular';
import { TileComponent } from './tile.component';

const meta: Meta<TileComponent> = {
  component: TileComponent,
  title: 'TileComponent',
};
export default meta;
type Story = StoryObj<TileComponent>;

export const Default: Story = {
  args: { TileVariant: 'default' },
  render: () => ({
    template: `<otui-tile [TileVariant]="'default'">Default Tile</otui-tile>`,
  }),
};

export const GradientGlow: Story = {
  args: { TileVariant: 'gradient-glow' },
  render: () => ({
    template: `<otui-tile [TileVariant]="'gradient-glow'">Gradient Glow Tile</otui-tile>`,
  }),
};

export const ElectricBorder: Story = {
  args: { TileVariant: 'electric-border' },
  render: () => ({
    template: `<otui-tile [TileVariant]="'electric-border'">Electric Border Tile</otui-tile>`,
  }),
};

export const GradientGlowCard: Story = {
  args: { TileVariant: 'gradient-glow-card' },
  render: () => ({
    template: `<otui-tile [TileVariant]="'gradient-glow-card'">Gradient Glow Card Tile</otui-tile>`,
  }),
};

export const GradientBackground: Story = {
  args: { TileVariant: 'gradient-background' },
  render: () => ({
    template: `<otui-tile [TileVariant]="'gradient-background'">Gradient Background Tile</otui-tile>`,
  }),
};