# Messaging & Chat

The messaging system enables private communication between users with real-time features.

## Features

### Direct Messaging

- One-on-one conversations
- Text messages with emoji support
- Image sharing
- Message history

### Real-time Features

- **Typing Indicators**: See when the other person is typing
- **Read Receipts**: Know when messages are seen
- **Online Status**: See when contacts are online
- **Message Reactions**: React to messages with emoji

### Chat Interface

- Floating chat button
- Conversation list
- Message thread view
- Unread message indicators

## Components

| Component         | Description         |
| ----------------- | ------------------- |
| ChatUiComponent   | Main chat interface |
| MessagesComponent | Messages page       |
| ChatService       | Chat management     |

## Services

| Service                | Description             |
| ---------------------- | ----------------------- |
| ChatService            | Conversation management |
| PresenceService        | Online status tracking  |
| SocialWebSocketService | Real-time messaging     |

## API Endpoints

| Method | Endpoint                             | Description            |
| ------ | ------------------------------------ | ---------------------- |
| GET    | `/api/chat/conversations`            | Get all conversations  |
| POST   | `/api/chat/conversations`            | Start new conversation |
| GET    | `/api/chat/messages/:conversationId` | Get messages           |
| POST   | `/api/chat/messages`                 | Send message           |

### Presence Endpoints

| Method | Endpoint                          | Description         |
| ------ | --------------------------------- | ------------------- |
| GET    | `/api/presence/:profileId`        | Get presence status |
| PUT    | `/api/presence/:profileId`        | Update presence     |
| GET    | `/api/presence/:profileId/typing` | Typing indicator    |

## WebSocket Events

Real-time communication via WebSocket:

- `chat:message` - New message
- `chat:typing` - Typing indicator
- `chat:read` - Read receipt
- `chat:reaction` - Message reaction
