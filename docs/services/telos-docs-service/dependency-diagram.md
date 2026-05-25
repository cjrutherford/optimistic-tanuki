# Telos Docs Service Dependency Diagram

```mermaid
flowchart LR
  Telos[telos-docs-service]
  Database[database]
  Logger[logger]
  Models[models]
  Persona[(PersonaTelos)]
  Profile[(ProfileTelos)]
  Project[(ProjectTelos)]
  Prompt[prompt-generation]

  Telos --> Database
  Telos --> Logger
  Telos --> Models
  Telos --> Persona
  Telos --> Profile
  Telos --> Project
  Telos --> Prompt
```
