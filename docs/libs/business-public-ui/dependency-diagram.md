# business-public-ui Dependency Diagram

```mermaid
flowchart LR
  PublicUI[business-public-ui]
  Data[business-data-access]
  Common[common-ui]
  Motion[motion-ui]
  Compose[compose-lib]

  PublicUI --> Data
  PublicUI --> Common
  PublicUI --> Motion
  PublicUI --> Compose
```
