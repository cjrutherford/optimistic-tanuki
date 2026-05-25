# app-registry-backend Export Map

```mermaid
flowchart TD
  Index[src/index.ts]
  Types[app-registry and navigation types]
  Registry[DEFAULT_APP_REGISTRY]
  Links[DEFAULT_NAVIGATION_LINKS]

  Index --> Types
  Index --> Registry
  Index --> Links
```
