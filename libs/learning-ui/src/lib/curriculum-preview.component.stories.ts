import type { Meta, StoryObj } from '@storybook/angular';
import { CurriculumPreviewComponent } from './curriculum-preview.component';
import { sampleCourses } from './learning.fixtures';

const meta: Meta<CurriculumPreviewComponent> = {
  component: CurriculumPreviewComponent,
  title: 'Curriculum Preview',
  tags: ['autodocs'],
  args: {
    heading: 'What is here',
    subheading: 'Three courses so far, more on the way.',
    courses: sampleCourses,
  },
  argTypes: { open: { action: 'open' } },
};

export default meta;
type Story = StoryObj<CurriculumPreviewComponent>;

export const Courses: Story = {};
export const Empty: Story = { args: { courses: [], subheading: '' } };
