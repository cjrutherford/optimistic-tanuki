# leads-feature-topics Topic Flow

```mermaid
flowchart TD
  UI[Topic management UI]
  Service[LeadTopicsService]
  Crud[Topic CRUD]
  Toggle[toggleTopic]
  Api[/api/leads/topics]

  UI --> Service
  Service --> Crud
  Service --> Toggle
  Crud --> Api
  Toggle --> Api
```
