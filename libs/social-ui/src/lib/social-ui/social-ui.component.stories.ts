import type { Meta, StoryObj } from '@storybook/angular';
import { SocialUiComponent } from './social-ui.component';
import { expect, within } from '@storybook/test';

const meta: Meta<SocialUiComponent> = {
  component: SocialUiComponent,
  title: 'SocialUiComponent',
};
export default meta;
type Story = StoryObj<SocialUiComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/social-ui works!/gi)).toBeTruthy();
  },
};
