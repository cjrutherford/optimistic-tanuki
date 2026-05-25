# payments-domain

`payments-domain` contains server-side payment-provider abstractions and the Lemon Squeezy adapter used by the payments service.

## Documentation

- architecture: [`../../../docs/libs/payments-domain/architecture.md`](../../../docs/libs/payments-domain/architecture.md)
- usage: [`../../../docs/libs/payments-domain/usage.md`](../../../docs/libs/payments-domain/usage.md)
- dependency diagram: [`../../../docs/libs/payments-domain/dependency-diagram.md`](../../../docs/libs/payments-domain/dependency-diagram.md)
- provider flow: [`../../../docs/libs/payments-domain/provider-flow.md`](../../../docs/libs/payments-domain/provider-flow.md)

## Public API

- provider adapter contracts
- checkout, webhook, and catalog types
- `LemonSqueezyAdapter`

## Nx Commands

```bash
pnpm exec nx test payments-domain
pnpm exec nx lint payments-domain
```
