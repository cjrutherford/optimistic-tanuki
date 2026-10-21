# Notifications

Notification lists, unread counts and read/delete controls use the selected profile's stream. The Gateway verifies that the profile still belongs to the authenticated account. Public notification creation is forbidden; existing server producers use Social's internal command at the trusted service boundary.

## Content and actions

Notification previews use generic server templates. API and notification socket projections omit stored sender identifiers, arbitrary text, resource references and action URLs. Historical rows have no reliable provenance, so a stored link is not treated as authorization to open content. Unknown historical types display a generic system notice. New notifications store template text.

The shared notification library provides the existing bell and list components. These UI components are reused. It can load notifications and mark or delete recipient-owned records through HTTP.

## Producer coverage and delivery limits

Social has producers for post likes, comments, follows and mentions. Performance alerts address actual owner-console profile IDs, with emails deduplicated by account. These source paths do not establish that every producer, delay or browser journey has been exercised.

Message and community-invitation types exist in the model, but their end-to-end producer flows remain **VERIFY**. Browser realtime notification delivery is **DEFER**: the shared UI still uses a stale raw WebSocket endpoint and normal Social producer push wiring has not been qualified. Authenticated server notification-room tests do not establish browser delivery. Do not advertise realtime delivery until a dedicated transport/producer slice proves it.

## API

| Method | Endpoint                                     | Behavior                                 |
| ------ | -------------------------------------------- | ---------------------------------------- |
| GET    | `/api/notifications/:profileId`              | Selected recipient's generic previews    |
| GET    | `/api/notifications/:profileId/unread-count` | Selected recipient's unread count        |
| POST   | `/api/notifications`                         | Forbidden                                |
| PUT    | `/api/notifications/:id/read`                | Mark a recipient-owned notification read |
| PUT    | `/api/notifications/:profileId/read-all`     | Mark selected recipient's stream read    |
| DELETE | `/api/notifications/:id`                     | Delete a recipient-owned notification    |

Notification snapshot/export disposition remains J23/J24. Download artifacts and account deletion are later work. Local acceptance and its limits are recorded in the release-readiness slice register.
