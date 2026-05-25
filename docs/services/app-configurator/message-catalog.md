# App Configurator Message Catalog

```mermaid
flowchart TD
  Service[app-configurator]
  Create[create]
  Get[get]
  Domain[getByDomain]
  Name[getByName]
  All[getAll]
  Update[update]
  Delete[delete]

  Service --> Create
  Service --> Get
  Service --> Domain
  Service --> Name
  Service --> All
  Service --> Update
  Service --> Delete
```
