import type { Meta, StoryObj } from '@storybook/angular';
import { EnrolmentGateComponent } from './enrolment-gate.component';

const meta: Meta<EnrolmentGateComponent> = {
  component: EnrolmentGateComponent,
  title: 'Enrolment Gate',
  tags: ['autodocs'],
  args: {
    offeringName: "Let's Go: the language in a week",
    busy: false,
    error: '',
  },
  argTypes: { enrol: { action: 'enrol' } },
};

export default meta;
type Story = StoryObj<EnrolmentGateComponent>;

export const Default: Story = {};
export const Enrolling: Story = { args: { busy: true } };
export const Failed: Story = {
  args: { error: 'Enrolment is closed for this course.' },
};
