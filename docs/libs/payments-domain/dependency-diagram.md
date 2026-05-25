# payments-domain Dependency Diagram

```mermaid
flowchart LR
  Domain[payments-domain]
  Payments[payments]
  Provider[Lemon Squeezy]

  Payments --> Domain
  Domain --> Provider
```
