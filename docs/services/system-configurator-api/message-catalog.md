# System Configurator API Message Catalog

```mermaid
flowchart TD
  Service[system-configurator-api]
  Chassis[chassis lookup]
  Compatibility[compatibility]
  Pricing[pricing]
  Order[order create/get]
  Saved[saved config create/get]

  Service --> Chassis
  Service --> Compatibility
  Service --> Pricing
  Service --> Order
  Service --> Saved
```
