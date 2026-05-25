# leads-feature-topics Dependency Diagram

```mermaid
flowchart LR
  Topics[leads-feature-topics]
  Contracts[leads-contracts]
  LeadsApp[leads-app]
  Api[/api/leads/topics]

  LeadsApp --> Topics
  Topics --> Contracts
  Topics --> Api
```
