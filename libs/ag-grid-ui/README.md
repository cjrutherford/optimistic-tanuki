# ag-grid-ui

A theme-aware AG Grid wrapper component for the Optimistic Tanuki workspace. This library provides an AG Grid integration that automatically adapts to the application's theme using the ThemeService.

## Features

- 🎨 **Theme-aware styling**: Automatically integrates with the application's ThemeService
- ⚙️ **Reasonable defaults**: Pre-configured with pagination, sorting, and filtering
- 📦 **Easy to use**: Simple input bindings for common use cases
- 🛠️ **Utility functions**: Helper functions for creating common column types
- 🎯 **Type-safe**: Full TypeScript support with re-exported AG Grid types

## Installation

This library is already part of the workspace. To use it in your application:

1. Add the library to your imports:
```typescript
import { AgGridUiComponent } from '@optimistic-tanuki/ag-grid-ui';
```

2. Import AG Grid styles in your application's styles.scss or angular.json

## Basic Usage

```typescript
import { Component } from '@angular/core';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

@Component({
  selector: 'app-my-table',
  imports: [AgGridUiComponent],
  template: `
    <otui-ag-grid
      [rowData]="rowData"
      [columnDefs]="columnDefs"
      [height]="'600px'"
    />
  `
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

## Building

Run `nx build ag-grid-ui` to build the library.

## Running unit tests

Run `nx test ag-grid-ui` to execute the unit tests.
