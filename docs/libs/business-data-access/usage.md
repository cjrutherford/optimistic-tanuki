# business-data-access Usage

## Primary Exports

- `BusinessApiService`
- `BusinessAuthService`
- `businessHttpInterceptor`
- `BusinessSiteConfigStore`
- `BusinessSiteConfig`

## Typical Integration Pattern

1. register the interceptor in the consuming Angular app
2. use `BusinessAuthService` for owner or client login
3. use `BusinessSiteConfigStore` for configuration state
4. use `BusinessApiService` for business endpoints

## Example

```ts
import { Component, inject } from '@angular/core';
import { BusinessApiService, BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';

@Component({
  selector: 'business-dashboard',
  standalone: true,
  template: `...`,
})
export class BusinessDashboardComponent {
  private readonly api = inject(BusinessApiService);
  readonly siteStore = inject(BusinessSiteConfigStore);

  readonly offers$ = this.api.getOffers();
}
```

## Operational Notes

- this library assumes a browser runtime for persisted auth state
- consuming apps should ensure `/api/authentication` and `/api/business` are reachable
- owner endpoints prefer owner tokens, while client-facing endpoints prefer client tokens

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [API Surface](./api-surface.md)
- [Auth Flow](./auth-flow.md)
- [Config Store Flow](./config-store-flow.md)
