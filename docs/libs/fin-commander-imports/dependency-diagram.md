# fin-commander-imports Dependency Diagram

```mermaid
flowchart LR
  Imports[fin-commander-imports]
  Finance[finance-ui]
  Registry[Import registry]
  Providers[Lazy-loaded providers]

  Imports --> Finance
  Imports --> Registry
  Registry --> Providers
```
