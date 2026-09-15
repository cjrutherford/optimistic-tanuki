import type { Meta, StoryObj } from '@storybook/angular';
import { sampleClassifiedAd } from '../models/classified-ad.fixtures';
import { ClassifiedCardComponent } from './classified-card.component';

const meta: Meta<ClassifiedCardComponent> = {
  component: ClassifiedCardComponent,
  title: 'Classified Card',
  tags: ['autodocs'],
  args: { ad: sampleClassifiedAd, showContact: false },
  argTypes: {
    view: { action: 'view' },
    contact: { action: 'contact' },
  },
  render: (args) => ({
    props: args,
    template: `<div style="max-width: 360px"><lib-classified-card [ad]="ad" [showContact]="showContact" (view)="view($event)" (contact)="contact($event)" /></div>`,
  }),
};

export default meta;
type Story = StoryObj<ClassifiedCardComponent>;

export const Default: Story = {};

export const WithContact: Story = {
  args: { showContact: true },
};

export const Featured: Story = {
  args: {
    ad: {
      ...sampleClassifiedAd,
      isFeatured: true,
      featuredUntil: '2026-09-20T15:00:00Z',
    },
  },
};

export const Sold: Story = {
  args: { ad: { ...sampleClassifiedAd, status: 'sold' } },
};

export const WithoutImage: Story = {
  args: { ad: { ...sampleClassifiedAd, imageUrls: null } },
};
