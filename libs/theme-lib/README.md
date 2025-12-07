# Theme Lib

This library contains services and utilities for managing themes. It provides a way to switch between different themes and to customize the appearance of the application.

## Usage

To use the services in this library, inject them into your Angular components or services:

```typescript
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  ...
})
export class MyComponent {
  constructor(private readonly themeService: ThemeService) {}
}
```

## Running unit tests

Run `nx test theme-lib` to execute the unit tests.