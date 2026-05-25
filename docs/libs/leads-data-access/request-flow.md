# leads-data-access Request Flow

```mermaid
flowchart TD
  UI[Leads UI]
  Service[LeadsApiService]
  Crud[/api/leads CRUD]
  Stats[/api/leads stats]

  UI --> Service
  Service --> Crud
  Service --> Stats
```
