import type { Meta, StoryObj } from '@storybook/angular';
import { ContactBubbleComponent } from './contact-bubble.component';


const meta: Meta<ContactBubbleComponent> = {
  component: ContactBubbleComponent,
  title: 'ContactBubbleComponent',
};
export default meta;
type Story = StoryObj<ContactBubbleComponent>;

export const Primary: Story = {
  args: {},
};


