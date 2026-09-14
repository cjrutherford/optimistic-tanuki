import type { Meta, StoryObj } from '@storybook/angular';
import { CourseCardComponent } from './course-card.component';

const meta: Meta<CourseCardComponent> = {
  component: CourseCardComponent,
  title: 'Course Card',
  tags: ['autodocs'],
  args: {
    displayName: "Let's Go: the language in a week",
    description:
      'Types, interfaces, goroutines and the standard library, one working program at a time.',
    variantLabel: 'Self-paced',
    isDraft: false,
    lessonCount: 14,
    credits: 3,
    level: 2,
    authorName: 'Ari Stone',
  },
  render: (args) => ({
    props: args,
    template: `<div style="max-width: 380px"><otlearn-course-card [displayName]="displayName" [description]="description" [variantLabel]="variantLabel" [isDraft]="isDraft" [lessonCount]="lessonCount" [credits]="credits" [level]="level" [authorName]="authorName" /></div>`,
  }),
};

export default meta;
type Story = StoryObj<CourseCardComponent>;

export const Published: Story = {};
export const Draft: Story = { args: { isDraft: true, lessonCount: 2 } };
