import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { expect, within } from '@storybook/test';
import { MessageService } from '../message.service';
import { MessageComponent } from './message.component';
import type { MessageType } from '../message.type';

// MessageComponent has no inputs: it renders whatever MessageService holds.
// Each story provides a service seeded with its messages. The signal is set
// directly because addMessage() dismisses non-error messages after a delay.
function withMessages(messages: MessageType[]) {
  return applicationConfig({
    providers: [
      {
        provide: MessageService,
        useFactory: () => {
          const service = new MessageService();
          service.messages.set(messages);
          return service;
        },
      },
    ],
  });
}

const meta: Meta<MessageComponent> = {
  component: MessageComponent,
  title: 'MessageComponent',
};
export default meta;
type Story = StoryObj<MessageComponent>;

export const Primary: Story = {
  decorators: [
    withMessages([
      { content: 'Workspace saved.', type: 'success' },
      { content: 'A new version is available.', type: 'info' },
      { content: 'Your session expires in five minutes.', type: 'warning' },
      { content: 'The upload did not finish.', type: 'error' },
    ]),
  ],
};

export const Heading: Story = {
  decorators: [withMessages([{ content: 'Message works!', type: 'info' }])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/message works!/i)).toBeTruthy();
  },
};
