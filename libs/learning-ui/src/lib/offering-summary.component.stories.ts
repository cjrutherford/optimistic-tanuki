import type { Meta, StoryObj } from '@storybook/angular';
import { samplePrerequisites } from './learning.fixtures';
import { OfferingSummaryComponent } from './offering-summary.component';

const meta: Meta<OfferingSummaryComponent> = {
  component: OfferingSummaryComponent,
  title: 'Offering Summary',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    displayName: 'Type systems for working programmers',
    description:
      'What a type checker proves, what it cannot, and how to use that when designing APIs.',
    audience: 'Developers comfortable in one typed language.',
    outcome:
      'You will read unfamiliar type signatures and design your own with intent.',
    trackDisplayName: 'Programming',
    authorName: 'Mika Vale',
    lessonCount: 9,
    level: 3,
    credits: 2,
    prerequisites: samplePrerequisites,
    isEnrolled: false,
    isDraft: false,
    busy: false,
    error: '',
  },
  argTypes: { enrol: { action: 'enrol' } },
};

export default meta;
type Story = StoryObj<OfferingSummaryComponent>;

export const NotEnrolled: Story = {};
export const Enrolled: Story = { args: { isEnrolled: true } };
export const Draft: Story = { args: { isDraft: true, prerequisites: [] } };
export const EnrolmentFailed: Story = {
  args: { error: 'Enrolment is closed for this course.' },
};
