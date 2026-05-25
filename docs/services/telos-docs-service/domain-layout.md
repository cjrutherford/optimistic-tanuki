# Telos Docs Service Domain Layout

```mermaid
flowchart TD
  AppModule[AppModule]
  PersonaDomain[persona-telos]
  ProfileDomain[profile-telos]
  ProjectDomain[project-telos]
  Seeds[seed-persona helpers]

  AppModule --> PersonaDomain
  AppModule --> ProfileDomain
  AppModule --> ProjectDomain
  PersonaDomain --> Seeds
```
