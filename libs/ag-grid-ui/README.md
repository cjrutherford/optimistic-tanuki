# ag-grid-ui

`ag-grid-ui` provides a theme-aware AG Grid wrapper for Angular applications in the workspace. Its source lives under `libs/ag-grid-ui/src/lib`.

## Repo Role

- shared AG Grid integration for frontend applications
- adapts grid behavior and styling to workspace theme and personality systems

## Nx Commands

```bash
pnpm exec nx build ag-grid-ui
pnpm exec nx test ag-grid-ui
```

## Features

- 🎨 **Theme-aware styling**: Automatically integrates with the application's ThemeService
- 🧬 **Personality-aware styling**: Adapts spacing, radius, typography, and shadow behavior from the active personality
- ⚙️ **Reasonable defaults**: Pre-configured with pagination, sorting, and filtering
- 📦 **Easy to use**: Simple input bindings for common use cases
- 🛠️ **Utility functions**: Helper functions for creating common column types
- 🎯 **Type-safe**: Full TypeScript support with re-exported AG Grid types
- ✅ **Pre-registered modules**: AG Grid Community modules automatically registered (v35+)

## Installation

This library is already part of the workspace. To use it in your application:

1. Add the library to your imports:

```typescript
import { AgGridUiComponent } from '@optimistic-tanuki/ag-grid-ui';
```

2. Import AG Grid styles in your application's `styles.scss` or `angular.json`:

```scss
@import 'ag-grid-community/styles/ag-grid.css';
@import 'ag-grid-community/styles/ag-theme-quartz.css';
```

**Note**: The library automatically registers AG Grid's `AllCommunityModule`, so you don't need to manually register modules in your application.

## Basic Usage

```typescript
import { Component } from '@angular/core';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

@Component({
  selector: 'app-my-table',
  imports: [AgGridUiComponent],
  template: ` <otui-ag-grid [rowData]="rowData" [columnDefs]="columnDefs" [height]="'600px'" /> `,
})
export class MyTableComponent {
  columnDefs: ColDef[] = [
    { field: 'name', headerName: 'Name' },
    { field: 'age', headerName: 'Age' },
    { field: 'email', headerName: 'Email' },
  ];

  rowData = [
    { name: 'John Doe', age: 30, email: 'john@example.com' },
    { name: 'Jane Smith', age: 25, email: 'jane@example.com' },
  ];
}
```

## API Reference

- generated Compodoc: `/docs/api/ag-grid-ui`
