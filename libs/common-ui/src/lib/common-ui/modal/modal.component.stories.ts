import type { Meta, StoryObj } from '@storybook/angular';
import { ModalComponent } from './modal.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ModalComponent> = {
  component: ModalComponent,
  title: 'ModalComponent',
};
export default meta;
type Story = StoryObj<ModalComponent>;

export const Primary: Story = {
  args: {
    heading: 'Primary Modal',
    mode: 'standard-modal',
  },
};

export const Sidebar: Story = {
  args: {
    heading: 'Sidebar Modal',
    mode: 'sidebar',
  },
};

export const Trough: Story = {
  args: {
    heading: 'Trough Modal',
    mode: 'trough',
  },
};

export const Captive: Story = {
  args: {
    heading: 'Captive Modal',
    mode: 'captive-modal',
  },
};

export const Heading: Story = {
  args: {
    heading: 'Test Heading',
    mode: 'standard-modal',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/test heading/gi)).toBeTruthy();
  },
};
