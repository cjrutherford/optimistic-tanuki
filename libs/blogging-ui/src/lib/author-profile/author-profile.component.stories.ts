import type { Meta, StoryObj } from '@storybook/angular';
import { AuthorProfileComponent } from './author-profile.component';
import { within } from '@storybook/test';
import { componentWrapperDecorator } from '@storybook/angular';
import { expect } from '@storybook/jest';

const meta: Meta<AuthorProfileComponent> = {
  component: AuthorProfileComponent,
  title: 'AuthorProfileComponent',
};
export default meta;
type Story = StoryObj<AuthorProfileComponent>;

export const Primary: Story = {
  args: {},
  decorators: [
    componentWrapperDecorator((story) => `<div style="width: 600px; margin: auto;">${story}</div>`),
  ]
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/author-profile works!/gi)).toBeTruthy();
  },
};
