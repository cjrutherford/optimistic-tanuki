# business-portal-ui Dependency Diagram

```mermaid
flowchart LR
  Portal[business-portal-ui]
  Data[business-data-access]
  Public[business-public-ui]
  Common[common-ui]
  Configurable[configurable-client-ui]
  Social[social-ui]

  Portal --> Data
  Portal --> Public
  Portal --> Common
  Portal --> Configurable
  Portal --> Social
```
