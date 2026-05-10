# Theme Lib

`theme-lib` contains runtime theme services and utilities used by frontend applications. Its source lives under `libs/theme-lib/src/lib`.

## Repo Role

- runtime theme selection and management
- shared theming helpers reused across Angular applications

## Nx Commands

```bash
pnpm exec nx build theme-lib
pnpm exec nx test theme-lib
```

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
