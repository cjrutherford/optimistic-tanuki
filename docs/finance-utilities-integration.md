# Integrated Financial Utilities Integration Notes

These utilities are implemented in the shared `@optimistic-tanuki/finance-ui`
route shell and backed by the standard finance/gateway services. The UI plug-in
pattern applies only to the Angular route layer.

## Fin Commander

Fin Commander mounts the shared finance routes at `/finance`, so the business
utility surfaces are available at:

- `/finance/business/invoices`
- `/finance/business/invoices/new`
- `/finance/business/checkout`
- `/finance/business/payments`

The app-level Cash Flow page links to these business utilities from the Business
workspace card. Tenant and app-scope headers continue to flow through the
existing Fin Commander finance interceptors.

## Business Site

Business Site mounts the shared finance route shell inside the guarded owner
workspace at `/owner/finance`. The owner utilities are available at:

- `/owner/finance/business/invoices`
- `/owner/finance/business/invoices/new`
- `/owner/finance/business/checkout`
- `/owner/finance/business/payments`

The owner portal nav and the `/owner/finance` route are enabled by
`features.invoices.enabled`. Owner finance uses `ownerFinanceFeatureGuard`, so a
disabled owner finance route redirects back to `/owner/dashboard` instead of the
client billing fallback. Business Site also treats `/api/finance/*` as an
owner-owned API surface in `businessHttpInterceptor`, so owner finance calls keep
the `business-site` app scope and prefer the owner token even when a client
session is present in the same browser.

## Other Hosts

Other Angular hosts should mount the same route factory under their branded
dashboard shell instead of duplicating invoice or checkout UI:

```ts
import { createFinanceRoutes, FINANCE_HOST_CONFIG } from '@optimistic-tanuki/finance-ui';

const financeConfig = {
  routeBase: '/owner/finance',
  shellTitle: 'Owner Finance',
  defaultWorkspace: 'business' as const,
};

export const routes = [
  {
    path: 'owner/finance',
    providers: [{ provide: FINANCE_HOST_CONFIG, useValue: financeConfig }],
    children: createFinanceRoutes(financeConfig),
  },
];
```

Hosts still own their auth guards, feature flags, app-scope headers, and tenant
selection policy. The backend remains standard finance/gateway service code,
not a backend plug-in.
