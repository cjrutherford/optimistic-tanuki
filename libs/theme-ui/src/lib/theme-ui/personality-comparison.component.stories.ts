import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalityComparisonComponent } from './personality-comparison.component';

const meta: Meta<PersonalityComparisonComponent> = {
  component: PersonalityComparisonComponent,
  title: 'Personality Comparison',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    primitive: {
      control: 'inline-radio',
      options: ['all', 'button', 'card', 'input'],
    },
  },
  args: { heading: 'Personality Comparison' },
  render: (args) => ({
    props: args,
    template: `<otui-personality-comparison [heading]="heading" [primitive]="primitive ?? 'all'" [personalities]="personalities" />`,
  }),
};

export default meta;
type Story = StoryObj<PersonalityComparisonComponent>;

export const AllPrimitives: Story = {};

export const Buttons: Story = {
  args: { heading: 'Buttons across personalities', primitive: 'button' },
};

export const ProductPersonalities: Story = {
  args: {
    heading: 'Product personalities',
    personalities: [
      'soft-touch',
      'bold',
      'professional',
      'control-center',
      'foundation',
    ],
  },
};
