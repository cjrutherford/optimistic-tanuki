# fin-commander-data-access Dependency Diagram

```mermaid
flowchart LR
  Data[fin-commander-data-access]
  Finance[finance-ui]
  Storage[localStorage]
  FutureApi[future Fin Commander backend]

  Data --> Finance
  Data --> Storage
  Data -. future .-> FutureApi
```
