import type { Meta, StoryObj } from '@storybook/angular';
import { sampleSubjects } from './learning.fixtures';
import { SubjectNavComponent } from './subject-nav.component';

const meta: Meta<SubjectNavComponent> = {
  component: SubjectNavComponent,
  title: 'Subject Nav',
  tags: ['autodocs'],
  args: { subjects: sampleSubjects, selected: '' },
  argTypes: {
    selected: {
      control: 'inline-radio',
      options: ['', ...sampleSubjects.map((s) => s.subjectId)],
    },
    select: { action: 'select' },
  },
};

export default meta;
type Story = StoryObj<SubjectNavComponent>;

export const Everything: Story = {};
export const SubjectSelected: Story = { args: { selected: 'design' } };
