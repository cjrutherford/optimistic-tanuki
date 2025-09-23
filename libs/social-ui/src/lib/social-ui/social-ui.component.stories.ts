import type { Meta, StoryObj } from '@storybook/angular';
import { SocialUiComponent } from './social-ui.component';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

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
    expect(canvas.getByText(/social-ui works!/gi)).toBeTruthy();
  },
};
