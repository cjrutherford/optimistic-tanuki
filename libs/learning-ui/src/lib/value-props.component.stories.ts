import type { Meta, StoryObj } from '@storybook/angular';
import { sampleValueProps } from './learning.fixtures';
import { ValuePropsComponent } from './value-props.component';

const meta: Meta<ValuePropsComponent> = {
  component: ValuePropsComponent,
  title: 'Value Props',
  tags: ['autodocs'],
  args: { heading: 'What you get', props: sampleValueProps },
};

export default meta;
type Story = StoryObj<ValuePropsComponent>;

export const Default: Story = {};
