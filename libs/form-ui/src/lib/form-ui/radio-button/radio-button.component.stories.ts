import type { Meta, StoryObj } from '@storybook/angular';
import { RadioButtonComponent } from './radio-button.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<RadioButtonComponent> = {
  component: RadioButtonComponent,
  title: 'RadioButtonComponent',
};
export default meta;
type Story = StoryObj<RadioButtonComponent>;

export const Primary: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' },
    ],
  },
};

export const Heading: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Option 1/gi)).toBeTruthy();
    expect(canvas.getByText(/Option 2/gi)).toBeTruthy();
    expect(canvas.getByText(/Option 3/gi)).toBeTruthy();
  },
};

export const Vertical: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' },
    ],
    layout: 'vertical',
  },
};

export const Horizontal: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' },
    ],
    layout: 'horizontal',
  },
};

export const Grid: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' },
    ],
    layout: 'grid',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Option 1/gi)).toBeTruthy();
    expect(canvas.getByText(/Option 2/gi)).toBeTruthy();
    expect(canvas.getByText(/Option 3/gi)).toBeTruthy();
  },
};
