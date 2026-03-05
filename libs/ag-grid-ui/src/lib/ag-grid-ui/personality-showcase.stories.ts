import type { Meta, StoryObj } from '@storybook/angular';
import { AgGridUiComponent } from './ag-grid-ui.component';

const meta: Meta<AgGridUiComponent> = {
  component: AgGridUiComponent,
  title: 'Theme/Personality Showcase',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<AgGridUiComponent>;

const sampleData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' },
];

const sampleColumns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'email', headerName: 'Email', flex: 1 },
  { field: 'status', headerName: 'Status', width: 100 },
];

export const Showcase: Story = {
  render: () => ({
    props: {
      rowData: sampleData,
      columnDefs: sampleColumns,
      height: '400px',
    },
    template: `
      <div style="padding: 24px; height: 100vh; background: var(--background, #fff); color: var(--foreground, #000);">
        <h2 style="font-family: var(--font-heading, system-ui); margin-bottom: 16px;">Personality Showcase</h2>
        <p style="margin-bottom: 24px; font-family: var(--font-body, system-ui);">
          Use the toolbar above to switch between personalities and color modes.
        </p>
        <otui-ag-grid
          [rowData]="rowData"
          [columnDefs]="columnDefs"
          [height]="height"
        ></otui-ag-grid>
      </div>
    `,
  }),
};
