import { componentWrapperDecorator, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { FeaturedPostsComponent } from './featured-posts.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

const meta: Meta<FeaturedPostsComponent> = {
  component: FeaturedPostsComponent,
  title: 'FeaturedPostsComponent',
  decorators: [
    moduleMetadata({
      imports: [BrowserAnimationsModule],
    }),
    componentWrapperDecorator((story) => `<div style="margin: 3em; width: 2400px; height: 600px;">${story}</div>`),
  ]
};
export default meta;
type Story = StoryObj<FeaturedPostsComponent>;

export const Primary: Story = {
  args: {
    visibleItems: 3,
  },
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/featured-posts works!/gi)).toBeTruthy();
  },
};
