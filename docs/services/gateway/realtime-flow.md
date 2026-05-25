# Gateway Realtime Flow

```mermaid
flowchart LR
  Client[Browser or tool client]
  Gateway[gateway]
  ChatGateway[ChatGateway]
  SocialGateway[SocialGateway]
  ChatService[chat-collector]
  Telos[telos-docs-service]
  Profile[profile]
  Social[social]
  AI[ai-orchestration]

  Client --> Gateway
  Gateway --> ChatGateway
  Gateway --> SocialGateway
  ChatGateway --> ChatService
  ChatGateway --> Telos
  ChatGateway --> Profile
  ChatGateway --> AI
  SocialGateway --> Social
```
