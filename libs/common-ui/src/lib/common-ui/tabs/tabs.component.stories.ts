import type { Meta, StoryObj } from '@storybook/angular';
import { Tab, TabsComponent } from './tabs.component';

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity', badge: 3 },
  { id: 'members', label: 'Members' },
  { id: 'billing', label: 'Billing', disabled: true },
];

const meta: Meta<TabsComponent> = {
  component: TabsComponent,
  title: 'Primitives/Tabs',
  tags: ['autodocs'],
  args: { tabs, activeTab: 'overview', vertical: false },
  argTypes: {
    activeTab: { control: 'inline-radio', options: tabs.map((tab) => tab.id) },
    tabChange: { action: 'tabChange' },
  },
};

export default meta;
type Story = StoryObj<TabsComponent>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  args: { vertical: true, activeTab: 'activity' },
};
