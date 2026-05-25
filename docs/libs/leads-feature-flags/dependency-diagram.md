# leads-feature-flags Dependency Diagram

```mermaid
flowchart LR
  Flags[leads-feature-flags]
  Contracts[leads-contracts]
  LeadsApp[leads-app]
  Api[/api/leads/:id/flags]

  LeadsApp --> Flags
  Flags --> Contracts
  Flags --> Api
```
