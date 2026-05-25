# App Configurator Dependency Diagram

```mermaid
flowchart LR
  AppCfg[app-configurator]
  Database[database]
  Logger[logger]
  Models[app-config-models]
  Postgres[(Postgres)]

  AppCfg --> Database
  AppCfg --> Logger
  AppCfg --> Models
  AppCfg --> Postgres
```
