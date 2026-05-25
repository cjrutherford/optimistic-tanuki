# leads-feature-onboarding Dependency Diagram

```mermaid
flowchart LR
  Onboarding[leads-feature-onboarding]
  Models[models]
  Contracts[leads-contracts]
  LeadsApp[leads-app]
  Api[/api/leads onboarding endpoints]

  LeadsApp --> Onboarding
  Onboarding --> Models
  Onboarding --> Contracts
  Onboarding --> Api
```
