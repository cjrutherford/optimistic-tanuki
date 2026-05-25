# Telos Docs Service Data Flow

```mermaid
flowchart TD
  Gateway[gateway or caller]
  Controller[Telos controller]
  Service[Domain service]
  Repo[TypeORM repository]
  Entity[Persona/Profile/Project Telos entity]
  DB[(Database)]

  Gateway --> Controller
  Controller --> Service
  Service --> Repo
  Repo --> Entity
  Entity --> DB
```
