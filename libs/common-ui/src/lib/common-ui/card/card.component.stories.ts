import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<CardComponent> = {
  component: CardComponent,
  title: 'CardComponent',
};
export default meta;
type Story = StoryObj<CardComponent>;

export const Default: Story = {
  args: { variant: 'default' },
  render: () => ({
    template: `
      <otui-card [CardVariant]="'default'">
        <div class="card-header">Default Card</div>
        <div class="card-body">This is the default card variant.</div>
      </otui-card>
    `,
  }),
};

export const GradientGlow: Story = {
  args: { variant: 'gradient-glow' },
  render: () => ({
    template: `
      <otui-card [CardVariant]="'gradient-glow'">
        <div class="card-header">Gradient Glow</div>
        <div class="card-body">This card uses the gradient glow border effect.</div>
      </otui-card>
    `,
  }),
};

export const ElectricBorder: Story = {
  args: { variant: 'electric-border' },
  render: () => ({
    template: `
      <otui-card [CardVariant]="'electric-border'">
        <div class="card-header">Electric Border</div>
        <div class="card-body">This card uses the electric border effect.</div>
      </otui-card>
    `,
  }),
};

export const GradientGlowCard: Story = {
  args: { variant: 'gradient-glow-card' },
  render: () => ({
    template: `
      <otui-card [CardVariant]="'gradient-glow-card'">
        <div class="card-header">Gradient Glow Card</div>
        <div class="card-body">This card uses the gradient glow card effect.</div>
      </otui-card>
    `,
  }),
};

export const GradientBackground: Story = {
  args: { variant: 'gradient-background' },
  render: () => ({
    template: `
      <otui-card [CardVariant]="'gradient-background'">
        <div class="card-header">Gradient Background</div>
        <div class="card-body">This card uses the gradient background effect.</div>
      </otui-card>
    `,
  }),
};