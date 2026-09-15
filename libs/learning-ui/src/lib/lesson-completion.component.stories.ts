import type { Meta, StoryObj } from '@storybook/angular';
import { LessonCompletionComponent } from './lesson-completion.component';

const meta: Meta<LessonCompletionComponent> = {
  component: LessonCompletionComponent,
  title: 'Lesson Completion',
  tags: ['autodocs'],
  args: { completed: false, busy: false, error: '' },
  argTypes: { toggle: { action: 'toggle' } },
};

export default meta;
type Story = StoryObj<LessonCompletionComponent>;

export const NotCompleted: Story = {};
export const Completed: Story = { args: { completed: true } };
export const Saving: Story = { args: { busy: true } };
export const Failed: Story = {
  args: { error: 'Could not save your progress. Try again.' },
};
