# hai-ui Usage

## Install and Import

The package name is `@optimistic-tanuki/hai-ui`.

Primary exports:

- `HaiAboutTagComponent`
- `HaiAboutModalComponent`
- `HaiExpansionComponent`
- `HaiAboutConfig`
- `HaiAppDirectoryService`

## Example

```ts
import { Component } from '@angular/core';
import { HaiAboutTagComponent, HaiAboutConfig } from '@optimistic-tanuki/hai-ui';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [HaiAboutTagComponent],
  template: `<hai-about-tag [config]="haiConfig" />`,
})
export class AppShellComponent {
  readonly haiConfig: HaiAboutConfig = {
    appId: 'example-app',
    appName: 'Example App',
    appTagline: 'A small app powered by HAI.',
    appDescription: 'Explains what the app is and links to related HAI projects.',
  };
}
```

## Operational Notes

- include Angular `HttpClient` support in the consuming app if you rely on `HaiAppDirectoryService`
- `/api/app-config` should be available if you want resolved deployed links
- without live config, the library still works and falls back to repository URLs

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Export Map](./export-map.md)
- [Component Relationship](./component-relationship.md)
