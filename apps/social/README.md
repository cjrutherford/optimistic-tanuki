# Social

<<<<<<< HEAD
This service is responsible for managing social media integrations. It provides a unified interface for interacting with various social media platforms, and is responsible for tasks such as posting updates, retrieving data, and managing social media accounts.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Social service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/social`.
=======
This project provides social networking features including posts, comments, votes, attachments, links, and following functionality.

## Features

- **Posts**: Create, read, update, and delete social posts
- **Comments**: Comment on posts with nested comment support
- **Votes**: Upvote/downvote posts and comments
- **Attachments**: Attach media files to posts
- **Links**: Share links with posts
- **Following**: Follow other users and see their activities

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `Post`: Social media posts
- `Comment`: Comments on posts
- `Vote`: Votes on posts and comments
- `Attachment`: Media attachments
- `Link`: URL links
- `FollowEntity`: User following relationships

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>,
  ) {}
}
```

## Running the Application

### Development
```bash
nx serve social
```

### Production Build
```bash
nx build social
```

### Docker
The social service is included in the main docker-compose stack:
```bash
docker-compose up social
```
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
