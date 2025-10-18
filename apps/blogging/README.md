# Blogging

<<<<<<< HEAD
This service is responsible for managing blog posts, comments, and other blogging-related functionality. It provides a rich and flexible platform for creating and managing blog content.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Blogging service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/blogging`.
=======
This project provides blogging functionality including posts, events, and contact management.

## Features

- **Blog Posts**: Create, edit, and publish blog posts
- **Events**: Manage and display events
- **Contact Management**: Handle contact submissions and inquiries

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `Post`: Blog posts with content and metadata
- `Event`: Event information and scheduling
- `Contact`: Contact form submissions

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>,
  ) {}
}
```

## API Endpoints

### Posts
- `GET /posts` - List all blog posts
- `GET /posts/:id` - Get a specific post
- `POST /posts` - Create a new post
- `PUT /posts/:id` - Update a post
- `DELETE /posts/:id` - Delete a post

### Events
- `GET /events` - List all events
- `GET /events/:id` - Get a specific event
- `POST /events` - Create a new event
- `PUT /events/:id` - Update an event
- `DELETE /events/:id` - Delete an event

### Contact
- `POST /contact` - Submit a contact form
- `GET /contact` - List contact submissions

## Running the Application

### Development
```bash
nx serve blogging
```

### Production Build
```bash
nx build blogging
```

### Docker
The blogging service is included in the main docker-compose stack:
```bash
docker-compose up blogging
```
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
