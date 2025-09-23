import type { Meta, StoryObj } from '@storybook/angular';
import { ContactFormComponent } from './contact-form.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta: Meta<ContactFormComponent> = {
  component: ContactFormComponent,
  title: 'ContactFormComponent',
};
export default meta;
type Story = StoryObj<ContactFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/contact-form works!/gi)).toBeTruthy();
  },
};
