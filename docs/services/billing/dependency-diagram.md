# Billing Dependency Diagram

```mermaid
flowchart LR
  Billing[billing]
  Contracts[billing-contracts]
  Domain[billing-domain]
  DataAccess[billing-data-access]
  Database[database]

  Billing --> Contracts
  Billing --> Domain
  Billing --> DataAccess
  Billing --> Database
```
