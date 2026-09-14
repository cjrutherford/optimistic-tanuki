import type { Meta, StoryObj } from '@storybook/angular';
import { NewsletterSignupComponent } from './newsletter-signup.component';
import { expect, within } from '@storybook/test';

const meta: Meta<NewsletterSignupComponent> = {
  component: NewsletterSignupComponent,
  title: 'NewsletterSignupComponent',
};
export default meta;
type Story = StoryObj<NewsletterSignupComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/newsletter-signup works!/gi)).toBeTruthy();
  },
};
