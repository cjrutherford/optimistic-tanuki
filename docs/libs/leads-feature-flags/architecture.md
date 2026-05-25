# leads-feature-flags Architecture

`leads-feature-flags` is the feature-scoped client layer for lead flagging and moderation-style review actions.

## Main Responsibilities

- fetch lead flags
- create or update lead flags
- isolate flagging concerns from general lead CRUD

## Consumers

- `leads-app`
