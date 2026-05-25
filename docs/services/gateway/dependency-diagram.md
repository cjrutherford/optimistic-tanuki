# Gateway Dependency Diagram

```mermaid
flowchart LR
  Gateway[gateway]
  Auth[authentication]
  Profile[profile]
  Social[social]
  Assets[assets]
  Planning[project-planning]
  Chat[chat-collector]
  Telos[telos-docs-service]
  AI[ai-orchestration]
  Blog[blogging]
  Perms[permissions]
  Store[store]
  AppConfig[app-configurator]
  Forum[forum]
  Finance[finance]
  Wellness[wellness]
  Classifieds[classifieds]
  Payments[payments]
  Leads[lead-tracker]
  SystemCfg[system-configurator-api]
  Videos[videos]
  Registry[app-registry-backend]
  PermissionLib[permission-lib]
  Bootstrap[auth-feature-account-bootstrap]

  Gateway --> Auth
  Gateway --> Profile
  Gateway --> Social
  Gateway --> Assets
  Gateway --> Planning
  Gateway --> Chat
  Gateway --> Telos
  Gateway --> AI
  Gateway --> Blog
  Gateway --> Perms
  Gateway --> Store
  Gateway --> AppConfig
  Gateway --> Forum
  Gateway --> Finance
  Gateway --> Wellness
  Gateway --> Classifieds
  Gateway --> Payments
  Gateway --> Leads
  Gateway --> SystemCfg
  Gateway --> Videos
  Gateway --> Registry
  Gateway --> PermissionLib
  Gateway --> Bootstrap
```
