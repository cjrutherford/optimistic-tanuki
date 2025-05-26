import type { Meta, StoryObj } from '@storybook/angular';
import { AccordionComponent } from './accordion.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<AccordionComponent> = {
  component: AccordionComponent,
  title: 'AccordionComponent',
};
export default meta;
type Story = StoryObj<AccordionComponent>;

export const Primary: Story = {
  args: {
    sections: [
      { heading: 'Section 1', content: 'Content 1' },
      { heading: 'Section 2', content: 'Content 2' },
      { heading: 'Section 3', content: 'Content 3' },
    ],
  },
};

export const Heading: Story = {
  args: {
    sections: [
      { heading: 'Section 1', content: 'Content 1' },
      { heading: 'Section 2', content: 'Content 2' },
      { heading: 'Section 3', content: 'Content 3' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Section 1/gi)).toBeTruthy();
  },
};
