/* eslint-disable @typescript-eslint/no-empty-function */
import type { Meta, StoryObj } from '@storybook/angular';
import { TableComponent } from './table.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<TableComponent> = {
  component: TableComponent,
  title: 'TableComponent',
};
export default meta;
type Story = StoryObj<TableComponent>;

export const Empty: Story = {
  args: {
    cells: [],
    rowIndex: 0,
    tableStyles: {},
    spacer: false,
  },
};

export const PriceList: Story = {
  args: {
    cells: [
      { heading: 'Tier 1', value: '$10' },
      { heading: 'Tier 2', value: '$20' },
      { heading: 'Tier 3', value: '$30' },
    ],
    rowActions: [
      { title: 'Edit', action: async () => {} },
      { title: 'View', action: async () => {} },
      { title: 'Delete', action: async () => {} },
    ],
    rowIndex: 0,
    tableStyles: {},
    spacer: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/tier 1/gi)).toBeTruthy();
    expect(canvas.getByText(/\$10/gi)).toBeTruthy();
    expect(canvas.getByText(/tier 2/gi)).toBeTruthy();
    expect(canvas.getByText(/\$20/gi)).toBeTruthy();
    expect(canvas.getByText(/tier 3/gi)).toBeTruthy();
    expect(canvas.getByText(/\$30/gi)).toBeTruthy();
  },
};

export const WithBadges: Story = {
  args: {
    cells: [
      { heading: 'Status', value: 'Active', isBadge: true },
      { heading: 'Status', value: 'Inactive', isBadge: true },
    ],
    rowActions: [
      { title: 'Activate', action: async () => {} },
      { title: 'Deactivate', action: async () => {} },
    ],
    rowIndex: 0,
    tableStyles: {},
    spacer: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/active/gi)).toBeTruthy();
    expect(canvas.getByText(/inactive/gi)).toBeTruthy();
  },
};

export const WithCustomStyles: Story = {
  args: {
    cells: [
      { heading: 'Name', value: 'John Doe', customStyles: { color: 'red' } },
      { heading: 'Age', value: '30', customStyles: { color: 'blue' } },
    ],
    rowActions: [
      { title: 'Edit', action: async () => {} },
      { title: 'Delete', action: async () => {} },
    ],
    rowIndex: 0,
    tableStyles: { border: '2px solid black' },
    spacer: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/john doe/gi)).toBeTruthy();
    expect(canvas.getByText(/30/gi)).toBeTruthy();
  },
};

export const WithSpacer: Story = {
  args: {
    cells: [
      { heading: 'Name', value: 'John Doe' },
      { heading: 'Age', value: '30' },
    ],
    rowActions: [
      { title: 'Edit', action: async () => {} },
      { title: 'Delete', action: async () => {} },
    ],
    rowIndex: 0,
    tableStyles: {},
    spacer: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/john doe/gi)).toBeTruthy();
    expect(canvas.getByText(/30/gi)).toBeTruthy();
  },
};

export const LightMode: Story = {
  args: {
    cells: [
      { heading: 'Name', value: 'John Doe' },
      { heading: 'Age', value: '30' },
    ],
    tableStyles: { backgroundColor: 'var(--accent-shade-lighten-50, #b1baec)', color: 'var(--foreground-color, #000)' },
  },
};

export const DarkMode: Story = {
  args: {
    cells: [
      { heading: 'Name', value: 'John Doe' },
      { heading: 'Age', value: '30' },
    ],
    tableStyles: { backgroundColor: 'var(--accent-shade-darken-50, #313a6c)', color: 'var(--foreground-color, #fff)' },
  },
};

export const FastCycleMode: Story = {
  args: {
    cells: [
      { heading: 'Name', value: 'John Doe' },
      { heading: 'Age', value: '30' },
    ],
    tableStyles: { background: 'var(--gradient-fastCycle)', color: 'var(--foreground-color, #fff)' },
  },
};
