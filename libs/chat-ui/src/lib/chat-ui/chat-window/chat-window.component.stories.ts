import type { Meta, StoryObj } from '@storybook/angular';
import { ChatWindowComponent } from './chat-window.component';


const meta: Meta<ChatWindowComponent> = {
  component: ChatWindowComponent,
  title: 'ChatWindowComponent',
};
export default meta;
type Story = StoryObj<ChatWindowComponent>;

export const Primary: Story = {
  args: {},
};


