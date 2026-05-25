# leads-feature-onboarding Onboarding Flow

```mermaid
flowchart TD
  User[User]
  Wizard[Onboarding wizard]
  Service[LeadOnboardingService]
  Analyze[Analyze onboarding]
  Interview[Advance interview]
  Confirm[Confirm onboarding]

  User --> Wizard
  Wizard --> Service
  Service --> Analyze
  Service --> Interview
  Service --> Confirm
```
