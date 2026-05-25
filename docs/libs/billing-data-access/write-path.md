# billing-data-access Write Path

```mermaid
flowchart TD
  Usage[Usage event request]
  Billing[billing service]
  Account[Billing account entity]
  Event[Usage event entity]
  Grant[Usage block grant entity]

  Usage --> Billing
  Billing --> Account
  Billing --> Event
  Billing --> Grant
```
