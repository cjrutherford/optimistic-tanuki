import type { Meta, StoryObj } from '@storybook/angular';
import { PersonalitySelectorComponent } from './personality-selector.component';

const meta: Meta<PersonalitySelectorComponent> = {
  component: PersonalitySelectorComponent,
  title: 'Personality Selector',
  tags: ['autodocs'],
  args: { applyOnSelect: true },
  argTypes: {
    personalitySelected: { action: 'personalitySelected' },
    onClose: { action: 'onClose' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Lists the theme service personalities and applies the one picked. Selecting a style here changes the toolbar-independent theme for the rest of the session.',
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `<div style="max-width: 520px"><lib-personality-selector [applyOnSelect]="applyOnSelect" (personalitySelected)="personalitySelected($event)" (onClose)="onClose($event)" /></div>`,
  }),
};

export default meta;
type Story = StoryObj<PersonalitySelectorComponent>;

export const AppliesSelection: Story = {};

export const EmitOnly: Story = {
  args: { applyOnSelect: false },
};
