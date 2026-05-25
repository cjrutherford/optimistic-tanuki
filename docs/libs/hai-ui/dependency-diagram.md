# hai-ui Dependency Diagram

```mermaid
flowchart LR
  HaiUI[hai-ui]
  CommonUI[common-ui]
  AppConfigModels[app-config-models]
  Http[Angular HttpClient]
  Api[/api/app-config]

  HaiUI --> CommonUI
  HaiUI --> AppConfigModels
  HaiUI --> Http
  Http --> Api
```
