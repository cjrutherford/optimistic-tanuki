# billing-data-access Dependency Diagram

```mermaid
flowchart LR
  Data[billing-data-access]
  Billing[billing]
  Postgres[(Postgres)]

  Billing --> Data
  Data --> Postgres
```
