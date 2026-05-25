# billing-domain Dependency Diagram

```mermaid
flowchart LR
  Domain[billing-domain]
  Contracts[billing-contracts]
  Billing[billing]

  Domain --> Contracts
  Billing --> Domain
```
