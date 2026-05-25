# billing-domain Architecture

`billing-domain` contains pure billing logic used by the `billing` service. It focuses on validating billing scope and turning billing contracts into invoice-preview outputs.

## Main Responsibilities

- validate required scope fields such as `tenantId` and `appScope`
- compute invoice preview outputs from subscription state, included usage, prepaid balance, and overage rules
- isolate invoice calculation logic from transport and persistence concerns

## Consumers

- `billing`

This library should remain a small domain layer with no transport-specific behavior.
