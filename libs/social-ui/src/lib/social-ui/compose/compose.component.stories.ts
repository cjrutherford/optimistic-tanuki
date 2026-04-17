import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { ComposeComponent } from './compose.component';
import { expect, within } from '@storybook/test';

const meta: Meta<ComposeComponent> = {
  component: ComposeComponent,
  title: 'ComposeComponent',
};
export default meta;
type Story = StoryObj<ComposeComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/What's on your mind\?/gi)).toBeTruthy();
  },
};
