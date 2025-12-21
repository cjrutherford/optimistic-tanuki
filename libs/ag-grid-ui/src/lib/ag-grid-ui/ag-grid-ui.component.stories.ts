import type { Meta, StoryObj } from '@storybook/angular';
import { AgGridUiComponent } from './ag-grid-ui.component';
import { ColDef } from 'ag-grid-community';

interface SampleData {
  name: string;
  age: number;
  email: string;
  department: string;
  salary: number;
  startDate: Date;
  status: string;
}

const sampleColumnDefs: ColDef<SampleData>[] = [
  { field: 'name', headerName: 'Name', flex: 2 },
  { field: 'age', headerName: 'Age', flex: 1 },
  { field: 'email', headerName: 'Email', flex: 2 },
  { field: 'department', headerName: 'Department', flex: 1 },
  {
    field: 'salary',
    headerName: 'Salary',
    flex: 1,
    valueFormatter: (params) => `$${params.value.toLocaleString()}`,
  },
  {
    field: 'startDate',
    headerName: 'Start Date',
    flex: 1,
    valueFormatter: (params) => new Date(params.value).toLocaleDateString(),
  },
  { field: 'status', headerName: 'Status', flex: 1 },
];

const sampleRowData: SampleData[] = [
  {
    name: 'John Doe',
    age: 30,
    email: 'john.doe@company.com',
    department: 'Engineering',
    salary: 95000,
    startDate: new Date('2020-01-15'),
    status: 'Active',
  },
  {
    name: 'Jane Smith',
    age: 28,
    email: 'jane.smith@company.com',
    department: 'Marketing',
    salary: 75000,
    startDate: new Date('2021-03-20'),
    status: 'Active',
  },
  {
    name: 'Bob Johnson',
    age: 35,
    email: 'bob.johnson@company.com',
    department: 'Sales',
    salary: 85000,
    startDate: new Date('2019-07-10'),
    status: 'Active',
  },
  {
    name: 'Alice Williams',
    age: 32,
    email: 'alice.williams@company.com',
    department: 'Engineering',
    salary: 105000,
    startDate: new Date('2018-11-05'),
    status: 'Active',
  },
  {
    name: 'Charlie Brown',
    age: 29,
    email: 'charlie.brown@company.com',
    department: 'HR',
    salary: 70000,
    startDate: new Date('2022-02-14'),
    status: 'Active',
  },
  {
    name: 'Diana Prince',
    age: 31,
    email: 'diana.prince@company.com',
    department: 'Engineering',
    salary: 98000,
    startDate: new Date('2020-06-01'),
    status: 'On Leave',
  },
  {
    name: 'Eve Davis',
    age: 27,
    email: 'eve.davis@company.com',
    department: 'Marketing',
    salary: 72000,
    startDate: new Date('2021-09-15'),
    status: 'Active',
  },
  {
    name: 'Frank Miller',
    age: 40,
    email: 'frank.miller@company.com',
    department: 'Management',
    salary: 125000,
    startDate: new Date('2015-04-20'),
    status: 'Active',
  },
];

const meta: Meta<AgGridUiComponent> = {
  component: AgGridUiComponent,
  title: 'AG Grid UI/Wrapper Component',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<AgGridUiComponent>;

export const Default: Story = {
  args: {
    rowData: sampleRowData,
    columnDefs: sampleColumnDefs,
    height: '500px',
  },
};

export const Empty: Story = {
  args: {
    rowData: [],
    columnDefs: sampleColumnDefs,
    height: '500px',
  },
};

export const SmallDataset: Story = {
  args: {
    rowData: sampleRowData.slice(0, 3),
    columnDefs: sampleColumnDefs,
    height: '400px',
  },
};

export const TallGrid: Story = {
  args: {
    rowData: sampleRowData,
    columnDefs: sampleColumnDefs,
    height: '700px',
  },
};

export const CustomPageSize: Story = {
  args: {
    rowData: sampleRowData,
    columnDefs: sampleColumnDefs,
    height: '500px',
    gridOptions: {
      paginationPageSize: 5,
    },
  },
};

export const NoPagination: Story = {
  args: {
    rowData: sampleRowData,
    columnDefs: sampleColumnDefs,
    height: '500px',
    gridOptions: {
      pagination: false,
    },
  },
};

export const SimpleColumns: Story = {
  args: {
    rowData: [
      { name: 'Item 1', value: 100 },
      { name: 'Item 2', value: 200 },
      { name: 'Item 3', value: 300 },
    ],
    columnDefs: [
      { field: 'name', headerName: 'Name' },
      { field: 'value', headerName: 'Value' },
    ],
    height: '300px',
  },
};
