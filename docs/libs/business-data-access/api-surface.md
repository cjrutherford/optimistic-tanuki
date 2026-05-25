# business-data-access API Surface

```mermaid
flowchart TD
  Api[BusinessApiService]
  Business[/api/business/*]
  Store[/api/store/products]
  Asset[/api/asset]
  Auth[/api/authentication/*]

  Api --> Business
  Api --> Store
  Api --> Asset
  Api -. auth dependency .-> Auth
```
