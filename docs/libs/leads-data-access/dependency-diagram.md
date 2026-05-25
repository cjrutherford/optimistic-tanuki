# leads-data-access Dependency Diagram

```mermaid
flowchart LR
  Data[leads-data-access]
  Contracts[leads-contracts]
  LeadsApp[leads-app]
  Api[/api/leads]

  LeadsApp --> Data
  Data --> Contracts
  Data --> Api
```
