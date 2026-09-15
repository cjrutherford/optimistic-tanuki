import type { Meta, StoryObj } from '@storybook/angular';
import { FlexLayoutComponent } from './flex-layout.component';

const box = (label: string) =>
  `<div style="padding: 16px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--border-radius-md)">${label}</div>`;

const meta: Meta<FlexLayoutComponent> = {
  component: FlexLayoutComponent,
  title: 'Layout/FlexLayout',
  tags: ['autodocs'],
  args: {
    direction: 'row',
    gap: '1rem',
    align: 'stretch',
    justify: 'flex-start',
  },
  argTypes: {
    direction: { control: 'inline-radio', options: ['row', 'column'] },
    align: {
      control: 'select',
      options: ['stretch', 'flex-start', 'center', 'flex-end'],
    },
    justify: {
      control: 'select',
      options: ['flex-start', 'center', 'flex-end', 'space-between'],
    },
  },
  render: (args) => ({
    props: args,
    template: `<otui-flex-layout [direction]="direction" [gap]="gap" [align]="align" [justify]="justify">${box(
      'One'
    )}${box('Two')}${box('Three')}</otui-flex-layout>`,
  }),
};

export default meta;
type Story = StoryObj<FlexLayoutComponent>;

export const Row: Story = {};

export const Column: Story = {
  args: { direction: 'column', gap: '0.5rem' },
};

export const SpaceBetween: Story = {
  args: { justify: 'space-between', align: 'center' },
};
