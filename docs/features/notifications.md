# Notifications System

The notifications system keeps users engaged by alerting them about interactions with their content.

## Notification Types

| Type             | Trigger                                |
| ---------------- | -------------------------------------- |
| Like             | Someone likes your post                |
| Comment          | Someone comments on your post          |
| Follow           | Someone follows you                    |
| Mention          | Someone mentions you in a post/comment |
| Message          | You receive a direct message           |
| Community Invite | Invitation to join a community         |
| System           | System announcements                   |

## Features

### Real-time Notifications

Notifications appear in real-time via WebSocket connections.

### Notification Bell

The bell icon in the toolbar shows:

- Unread notification count
- Dropdown with recent notifications
- Mark all as read functionality

### Notification Page

Full notification history with:

- Grouped notifications by date
- Filter by type
- Mark as read/unread
- Delete notifications

## Components

| Component                 | Description             |
| ------------------------- | ----------------------- |
| NotificationBellComponent | Bell icon with dropdown |
| NotificationListComponent | Full notification page  |

## Service

| Service             | Description                           |
| ------------------- | ------------------------------------- |
| NotificationService | Load, mark read, delete notifications |

## API Endpoints

| Method | Endpoint                                     | Description           |
| ------ | -------------------------------------------- | --------------------- |
| GET    | `/api/notifications/:profileId`              | Get all notifications |
| GET    | `/api/notifications/:profileId/unread-count` | Get unread count      |
| POST   | `/api/notifications`                         | Create notification   |
| PUT    | `/api/notifications/:id/read`                | Mark as read          |
| PUT    | `/api/notifications/:profileId/read-all`     | Mark all as read      |
| DELETE | `/api/notifications/:id`                     | Delete notification   |

## Notification Triggers

Notifications are automatically created when:

- A post receives a like
- A comment is added to a post
- A user follows another user
- A user is mentioned
- A direct message is received
- A community invitation is sent
