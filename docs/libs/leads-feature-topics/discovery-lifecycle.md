# leads-feature-topics Discovery Lifecycle

```mermaid
flowchart TD
  Topic[Enabled topic]
  Run[runTopicDiscovery]
  Status[getTopicDiscoveryStatus]
  Results[Discovery results]

  Topic --> Run
  Run --> Status
  Status --> Results
```
