import type { Meta, StoryObj } from '@storybook/angular';
import { ChatUiComponent } from './chat-ui.component';


const meta: Meta<ChatUiComponent> = {
  component: ChatUiComponent,
  title: 'ChatUiComponent',
};
export default meta;
type Story = StoryObj<ChatUiComponent>;

export const Primary: Story = {
  args: {},
};


