# business-data-access Dependency Diagram

```mermaid
flowchart LR
  BDA[business-data-access]
  Http[Angular HttpClient]
  Models[models]
  UIModels[ui-models]
  AppConfig[BusinessSiteConfig]
  Auth[BusinessAuthService]

  BDA --> Http
  BDA --> Models
  BDA --> UIModels
  BDA --> AppConfig
  BDA --> Auth
```
