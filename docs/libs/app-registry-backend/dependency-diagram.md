# app-registry-backend Dependency Diagram

```mermaid
flowchart LR
  RegistryLib[app-registry-backend]
  Gateway[gateway]
  Registry[app-registry]
  Owner[owner-console]

  RegistryLib --> Gateway
  RegistryLib --> Registry
  RegistryLib --> Owner
```
