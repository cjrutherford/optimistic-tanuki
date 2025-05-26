import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ButtonComponent> = {
  component: ButtonComponent,
  title: 'ButtonComponent',
};
export default meta;
type Story = StoryObj<ButtonComponent>;

export const Primary: Story = {
  args: {
    disabled: false,
    variant: 'primary',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="primary">Primary</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Primary');
    await expect(button).not.toBeDisabled();
  },
};

export const Secondary: Story = {
  args: {
    disabled: false,
    variant: 'secondary',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="secondary">Secondary</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Secondary');
    await expect(button).not.toBeDisabled();
  },
};

export const Outlined: Story = {
  args: {
    disabled: false,
    variant: 'outlined',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="outlined">Outlined</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Outlined');
    await expect(button).not.toBeDisabled();
  },
};

export const Text: Story = {
  args: {
    disabled: false,
    variant: 'text',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="text">Text</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Text');
    await expect(button).not.toBeDisabled();
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    variant: 'primary',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="primary">Disabled</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Disabled');
    await expect(button).toBeDisabled();
  },
};

export const Success: Story = {
  args: {
    disabled: false,
    variant: 'success',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="success">Success</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Success');
    await expect(button).not.toBeDisabled();
  },
};

export const Danger: Story = {
  args: {
    disabled: false,
    variant: 'danger',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="danger">Danger</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Danger');
    await expect(button).not.toBeDisabled();
  },
};

export const Warning: Story = {
  args: {
    disabled: false,
    variant: 'warning',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="warning">Warning</otui-button>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Warning');
    await expect(button).not.toBeDisabled();
  },
};

export const LightMode: Story = {
  args: {
    disabled: false,
    variant: 'primary',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="primary" class="light-mode">Light Mode</otui-button>`,
  }),
};

export const DarkMode: Story = {
  args: {
    disabled: false,
    variant: 'primary',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="primary" class="dark-mode">Dark Mode</otui-button>`,
  }),
};

export const FastCycleMode: Story = {
  args: {
    disabled: false,
    variant: 'primary',
  },
  render: (args) => ({
    props: args,
    template: `<otui-button [disabled]="disabled" variant="primary" class="fast-cycle-mode">Fast Cycle Mode</otui-button>`,
  }),
};


