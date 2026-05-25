# billing-domain

`billing-domain` contains server-side billing domain logic for scope validation and invoice preview calculation.

## Documentation

- architecture: [`../../../docs/libs/billing-domain/architecture.md`](../../../docs/libs/billing-domain/architecture.md)
- usage: [`../../../docs/libs/billing-domain/usage.md`](../../../docs/libs/billing-domain/usage.md)
- dependency diagram: [`../../../docs/libs/billing-domain/dependency-diagram.md`](../../../docs/libs/billing-domain/dependency-diagram.md)
- invoice preview flow: [`../../../docs/libs/billing-domain/invoice-preview-flow.md`](../../../docs/libs/billing-domain/invoice-preview-flow.md)

## Public API

- `assertBillingScope(...)`
- `InvoicePreviewService`

## Nx Commands

```bash
pnpm exec nx test billing-domain
pnpm exec nx lint billing-domain
```
