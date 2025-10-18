# Chat Collector

<<<<<<< HEAD
This service is responsible for collecting and storing chat messages from various sources. It provides a centralized location for storing and retrieving chat data, as well as for performing various operations on it, such as searching and filtering.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Chat Collector service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/chat-collector`.
=======
This project collects and processes chat data, managing conversations and messages for chat-based applications.

## Features

- **Message Collection**: Store and retrieve chat messages
- **Conversation Management**: Track and organize conversations
- **Message History**: Maintain complete chat history

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `Message`: Individual chat messages
- `Conversation`: Chat conversation threads

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @Inject(getRepositoryToken(Message))
    private readonly messageRepo: Repository<Message>,
  ) {}
}
```

## API Endpoints

### Messages
- `POST /messages` - Send a new message
- `GET /messages/:conversationId` - Get messages for a conversation

### Conversations
- `GET /conversations` - List all conversations
- `GET /conversations/:id` - Get a specific conversation
- `POST /conversations` - Create a new conversation

## Running the Application

### Development
```bash
nx serve chat-collector
```

### Production Build
```bash
nx build chat-collector
```

### Docker
The chat-collector service is included in the main docker-compose stack:
```bash
docker-compose up chat-collector
```
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
