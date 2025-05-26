import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<CardComponent> = {
  component: CardComponent,
  title: 'CardComponent',
};
export default meta;
type Story = StoryObj<CardComponent>;

export const Empty: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  render: () => ({
    template: `
      <otui-card>
        <div class="card-header">Card Header</div>
        <div class="card-body">This is a card with a header.</div>
      </otui-card>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Card Header/gi)).toBeTruthy();
  },
};

export const WithHeader: Story = {
  args: {},
  render: () => ({
    template: `
      <otui-card>
        <div class="card-header">Card Header</div>
        <div class="card-body">This is a card with a header.</div>
      </otui-card>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Card Header/gi)).toBeTruthy();
  },
};

export const WithFooter: Story = {
  args: {},
  render: () => ({
    template: `
      <otui-card>
        <div class="card-body">This is a card with a footer.</div>
        <div class="card-footer">Card Footer</div>
      </otui-card>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Card Footer/gi)).toBeTruthy();
  },
};

export const WithHeaderAndFooter: Story = {
  args: {},
  render: () => ({
    template: `
      <otui-card>
        <div class="card-header">Card Header</div>
        <div class="card-body">This is a card with both header and footer.</div>
        <div class="card-footer">Card Footer</div>
      </otui-card>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Card Header/gi)).toBeTruthy();
    expect(canvas.getByText(/Card Footer/gi)).toBeTruthy();
  },
};

export const LightMode: Story = {
  args: {},
  render: () => ({
    template: `
      <otui-card class="light-mode">
        <div class="card-header">Card Header</div>
        <div class="card-body">This is a card in light mode.</div>
      </otui-card>
    `,
  }),
};

export const DarkMode: Story = {
  args: {},
  render: () => ({
    template: `
      <otui-card class="dark-mode">
        <div class="card-header">Card Header</div>
        <div class="card-body">This is a card in dark mode.</div>
      </otui-card>
    `,
  }),
};

export const FastCycleMode: Story = {
  args: {},
  render: () => ({
    template: `
      <otui-card class="fast-cycle-mode">
        <div class="card-header">Card Header</div>
        <div class="card-body">This is a card in fast cycle mode.</div>
      </otui-card>
    `,
  }),
};
