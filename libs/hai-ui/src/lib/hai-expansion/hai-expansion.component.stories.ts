import type { Meta, StoryObj } from '@storybook/angular';
import { HaiExpansionComponent } from './hai-expansion.component';

const meta: Meta<HaiExpansionComponent> = {
  component: HaiExpansionComponent,
  title: 'Expansion',
  tags: ['autodocs'],
  args: { showExpansionOnInit: true },
};

export default meta;
type Story = StoryObj<HaiExpansionComponent>;

export const Expanded: Story = {};

export const Collapsed: Story = {
  args: { showExpansionOnInit: false },
};
