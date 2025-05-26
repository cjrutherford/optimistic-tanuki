import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { ComposeComponent } from './compose.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { QuillModule } from 'ngx-quill';

const meta: Meta<ComposeComponent> = {
  component: ComposeComponent,
  title: 'ComposeComponent',
  decorators: [
      moduleMetadata({
        imports: [QuillModule.forRoot()],
      })
  ]
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
    expect(canvas.getByText(/What's on your mind\?/gi)).toBeTruthy();
  },
};
