/* eslint-disable @typescript-eslint/no-empty-function */
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TableComponent, TableColumn, TableRow, TableAction } from './table.component';
import { CommonModule } from '@angular/common';

const meta: Meta<TableComponent> = {
  component: TableComponent,
  title: 'Components/Table',
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
  parameters: {
    componentSubtitle: 'A fully accessible semantic table component with sorting, selection, and theme support',
    docs: {
      description: {
        component: `
The Table component provides a standardized, accessible way to display tabular data.

## Features
- ✅ Semantic HTML5 table structure
- ✅ Full ARIA support for screen readers
- ✅ Column sorting
- ✅ Row selection (single/multi)
- ✅ Row actions
- ✅ Responsive design with horizontal scroll
- ✅ Theme-aware with personality support
- ✅ Multiple variants (default, bordered, striped, minimal)
- ✅ Compact mode for dense data
- ✅ Sticky headers for long tables

## Migration Notice
**The old single-row API using 'cells' input is deprecated.**
Please migrate to the new multi-row API using 'data' and 'columns' inputs.
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'bordered', 'striped', 'minimal'],
      description: 'Visual variant of the table',
    },
    sortable: {
      control: 'boolean',
      description: 'Enable column sorting',
    },
    selectable: {
      control: 'boolean',
      description: 'Enable row selection with checkboxes',
    },
    striped: {
      control: 'boolean',
      description: 'Enable striped row backgrounds',
    },
    compact: {
      control: 'boolean',
      description: 'Use compact spacing for dense tables',
    },
    hoverable: {
      control: 'boolean',
      description: 'Show hover effect on rows',
    },
    stickyHeader: {
      control: 'boolean',
      description: 'Keep header visible when scrolling',
    },
  },
};
export default meta;
type Story = StoryObj<TableComponent>;

// ==================== SAMPLE DATA ====================

const sampleColumns: TableColumn[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  { key: 'role', header: 'Role', type: 'badge' },
  { key: 'status', header: 'Status', sortable: true },
  { key: 'lastActive', header: 'Last Active', align: 'center' },
];

const sampleData: TableRow[] = [
  { name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active', lastActive: '2 min ago' },
  { name: 'Jane Smith', email: 'jane@example.com', role: 'Editor', status: 'Active', lastActive: '1 hour ago' },
  { name: 'Bob Johnson', email: 'bob@example.com', role: 'Viewer', status: 'Inactive', lastActive: '2 days ago' },
  { name: 'Alice Williams', email: 'alice@example.com', role: 'Editor', status: 'Active', lastActive: '5 min ago' },
  { name: 'Charlie Brown', email: 'charlie@example.com', role: 'Viewer', status: 'Pending', lastActive: '1 week ago' },
];

const sampleActions: TableAction[] = [
  { label: 'Edit', action: (row) => console.log('Edit:', row), variant: 'primary' },
  { label: 'Delete', action: (row) => console.log('Delete:', row), variant: 'danger' },
];

// ==================== NEW API STORIES ====================

export const Default: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    hoverable: true,
    ariaLabel: 'User management table',
    caption: 'User List',
  },
};

export const WithSorting: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    sortable: true,
    ariaLabel: 'Sortable user table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Click on column headers to sort. The table tracks sort state and emits sort events.',
      },
    },
  },
};

export const WithSelection: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    selectable: true,
    ariaLabel: 'Selectable user table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Checkboxes allow selecting individual rows or all rows. Selection state is emitted via rowSelect event.',
      },
    },
  },
};

export const WithActions: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    actions: sampleActions,
    ariaLabel: 'User table with actions',
  },
  parameters: {
    docs: {
      description: {
        story: 'Row actions appear in the rightmost column. Each action can have a variant (primary, secondary, danger).',
      },
    },
  },
};

export const Striped: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    striped: true,
    hoverable: true,
    ariaLabel: 'Striped user table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Striped rows improve readability for dense data.',
      },
    },
  },
};

export const Compact: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    compact: true,
    ariaLabel: 'Compact user table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact mode reduces padding for tables with many rows.',
      },
    },
  },
};

export const Bordered: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    variant: 'bordered',
    ariaLabel: 'Bordered user table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Bordered variant shows grid lines between all cells.',
      },
    },
  },
};

export const Minimal: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    variant: 'minimal',
    ariaLabel: 'Minimal user table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Minimal variant removes outer borders for a cleaner look.',
      },
    },
  },
};

export const Empty: Story = {
  args: {
    columns: sampleColumns,
    data: [],
    emptyMessage: 'No users found',
    ariaLabel: 'Empty user table',
  },
};

export const StickyHeader: Story = {
  args: {
    columns: sampleColumns,
    data: [...sampleData, ...sampleData, ...sampleData, ...sampleData],
    stickyHeader: true,
    ariaLabel: 'User table with sticky header',
  },
  parameters: {
    docs: {
      description: {
        story: 'Sticky header keeps column headers visible when scrolling through long tables.',
      },
    },
  },
};

export const FullFeatured: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    sortable: true,
    selectable: true,
    striped: true,
    hoverable: true,
    actions: sampleActions,
    caption: 'Full-Featured User Table',
    ariaLabel: 'Full-featured user management table',
  },
  parameters: {
    docs: {
      description: {
        story: 'This example shows all features combined: sorting, selection, striped rows, hover effects, and actions.',
      },
    },
  },
};

// ==================== ACCESSIBILITY STORY ====================

export const Accessibility: Story = {
  args: {
    columns: [
      { key: 'feature', header: 'Feature' },
      { key: 'support', header: 'Support', align: 'center' },
    ],
    data: [
      { feature: 'Semantic HTML5 table structure', support: '✅' },
      { feature: 'ARIA roles (table, row, columnheader, cell)', support: '✅' },
      { feature: 'ARIA sort indicators', support: '✅' },
      { feature: 'Keyboard navigation', support: '✅' },
      { feature: 'Screen reader labels', support: '✅' },
      { feature: 'Reduced motion support', support: '✅' },
    ],
    striped: true,
    caption: 'Accessibility Features',
    ariaLabel: 'Table showing accessibility features',
  },
  parameters: {
    docs: {
      description: {
        story: 'This table documents the accessibility features built into the component.',
      },
    },
  },
};

// ==================== LEGACY API STORIES (Deprecated) ====================

export const LegacySingleRow: Story = {
  args: {
    cells: [
      { heading: 'Name', value: 'John Doe' },
      { heading: 'Email', value: 'john@example.com' },
      { heading: 'Role', value: 'Admin' },
    ],
    rowActions: [
      { title: 'Edit', action: async () => {} },
      { title: 'Delete', action: async () => {} },
    ],
    rowIndex: 0,
  },
  parameters: {
    docs: {
      description: {
        story: `
**⚠️ DEPRECATED API**

This example uses the legacy single-row API which is deprecated and will be removed in v2.0.
Please migrate to the new multi-row API using 'data' and 'columns' inputs.

Check the browser console for deprecation warnings.
        `,
      },
    },
  },
};

export const LegacyWithBadges: Story = {
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
  },
  parameters: {
    docs: {
      description: {
        story: '**⚠️ DEPRECATED**: Use columns with type="badge" instead.',
      },
    },
  },
};

export const LegacyPriceList: Story = {
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
  },
  parameters: {
    docs: {
      description: {
        story: '**⚠️ DEPRECATED**: Legacy single-row pricing table.',
      },
    },
  },
};
