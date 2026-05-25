# fin-commander-imports Provider Architecture

```mermaid
flowchart TD
  Workbench[Import workbench]
  Registry[FinCommanderImportRegistryService]
  Csv[csv provider]
  Demo[demo-bank provider]
  Future[future providers]

  Workbench --> Registry
  Registry --> Csv
  Registry --> Demo
  Registry --> Future
```
