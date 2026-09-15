import type { Meta, StoryObj } from '@storybook/angular';
import { sampleTags } from '../project-ui.fixtures';
import { TagSelectorComponent } from './tag-selector.component';

const meta: Meta<TagSelectorComponent> = {
  component: TagSelectorComponent,
  title: 'Tasks/Tag Selector',
  tags: ['autodocs'],
  args: { availableTags: sampleTags, selectedTagIds: ['tag-design'] },
  argTypes: { selectionChange: { action: 'selectionChange' } },
};

export default meta;
type Story = StoryObj<TagSelectorComponent>;

export const Default: Story = {};
export const NoneSelected: Story = { args: { selectedTagIds: [] } };
