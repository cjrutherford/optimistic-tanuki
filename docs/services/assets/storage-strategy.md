# Assets Storage Strategy

```mermaid
flowchart LR
  Config[ConfigService]
  Module[StorageModule.registerAsync]
  Local[Local adapter]
  Network[S3-compatible adapter]
  Service[AppService]

  Config --> Module
  Module --> Local
  Module --> Network
  Local --> Service
  Network --> Service
```
