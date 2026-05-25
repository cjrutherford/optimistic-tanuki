# business-portal-ui Export Map

```mermaid
flowchart TD
  Index[src/index.ts]
  Shell[Portal shell]
  Owner[Owner pages]
  Client[Client pages]
  Editor[Site editor page]

  Index --> Shell
  Index --> Owner
  Index --> Client
  Index --> Editor
```
