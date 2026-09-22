# @optimistic-tanuki/finance-data-access

Angular data-access for the finance domain: the `/api/finance` HTTP client
(`FinanceService`) plus its models. Promoted out of `finance-ui` per T3 — a
data service and its shapes do not belong in a `type:ui` lib, and their
presence there forced `fin-commander-data-access` into a layer-violating
`data-access → ui` dependency.

`finance-ui` re-exports this lib for back-compat; new code imports from here.
Canonical DTOs for the finance TCP surface live in `finance-contracts`.
