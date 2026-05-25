# System Configurator API Dependency Diagram

```mermaid
flowchart LR
  API[system-configurator-api]
  Database[database]
  Logger[logger]
  Postgres[(Postgres)]
  External[PCPartPicker]

  API --> Database
  API --> Logger
  API --> Postgres
  API --> External
```
