import type { Meta, StoryObj } from '@storybook/angular';
import { sampleClassifiedAd } from '../models/classified-ad.fixtures';
import { ClassifiedFormComponent } from './classified-form.component';

const meta: Meta<ClassifiedFormComponent> = {
  component: ClassifiedFormComponent,
  title: 'Classified Form',
  tags: ['autodocs'],
  args: { communityId: 'community-1' },
  argTypes: {
    submitForm: { action: 'submitForm' },
    cancel: { action: 'cancel' },
  },
};

export default meta;
type Story = StoryObj<ClassifiedFormComponent>;

export const NewListing: Story = {};

export const EditListing: Story = {
  args: { existingAd: sampleClassifiedAd },
};
