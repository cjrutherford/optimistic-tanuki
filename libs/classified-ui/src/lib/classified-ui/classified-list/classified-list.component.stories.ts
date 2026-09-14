import type { Meta, StoryObj } from '@storybook/angular';
import { sampleClassifiedAds } from '../models/classified-ad.fixtures';
import { ClassifiedListComponent } from './classified-list.component';

const meta: Meta<ClassifiedListComponent> = {
  component: ClassifiedListComponent,
  title: 'Classified List',
  tags: ['autodocs'],
  args: {
    ads: sampleClassifiedAds,
    loading: false,
    showPostButton: true,
    showContact: false,
  },
  argTypes: {
    postNew: { action: 'postNew' },
    viewAd: { action: 'viewAd' },
    contactSeller: { action: 'contactSeller' },
  },
};

export default meta;
type Story = StoryObj<ClassifiedListComponent>;

export const Listings: Story = {};

export const Loading: Story = {
  args: { ads: [], loading: true },
};

export const Empty: Story = {
  args: { ads: [] },
};
