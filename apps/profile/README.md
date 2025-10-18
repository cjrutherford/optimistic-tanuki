# Profile

<<<<<<< HEAD
This service is responsible for managing user profiles. It provides a centralized location for storing and retrieving user data, such as personal information, preferences, and settings.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Profile service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/profile`.
=======
This project manages user profiles and timelines.

## Features

- **Profiles**: User profile management with personal information
- **Timelines**: User activity timelines and event tracking

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `Profile`: User profile information
- `Timeline`: User timeline events

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(getRepositoryToken(Profile))
    private readonly profileRepo: Repository<Profile>,
  ) {}
}
```

## API Endpoints

### Profiles
- `GET /profiles` - List all profiles
- `GET /profiles/:id` - Get a specific profile
- `POST /profiles` - Create a new profile
- `PUT /profiles/:id` - Update a profile
- `DELETE /profiles/:id` - Delete a profile

### Timelines
- `GET /timelines/:userId` - Get user timeline
- `POST /timelines` - Add timeline event

## Running the Application

### Development
```bash
nx serve profile
```

### Production Build
```bash
nx build profile
```

### Docker
The profile service is included in the main docker-compose stack:
```bash
docker-compose up profile
```
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
