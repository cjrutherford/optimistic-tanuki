import type { Meta, StoryObj } from '@storybook/angular';
import { sampleAiChanges, sampleProject } from '../project-ui.fixtures';
import { AiChangeReviewComponent } from './ai-change-review.component';

const meta: Meta<AiChangeReviewComponent> = {
  component: AiChangeReviewComponent,
  title: 'Assistant/AI Change Review',
  tags: ['autodocs'],
  args: {
    changes: sampleAiChanges,
    project: sampleProject,
    busyId: null,
    asking: false,
  },
  argTypes: {
    decided: { action: 'decided' },
    suggestionsRequested: { action: 'suggestionsRequested' },
  },
};

export default meta;
type Story = StoryObj<AiChangeReviewComponent>;

export const Proposals: Story = {};
export const Deciding: Story = { args: { busyId: 'ai-1' } };
export const Asking: Story = { args: { changes: [], asking: true } };
