# Telos Docs Service

<<<<<<< HEAD
This service is responsible for managing documentation for the Telos project. It provides a centralized location for storing and retrieving documentation, as well as for performing various operations on it, such as searching and filtering.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Telos Docs Service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/telos-docs-service`.
=======
This project provides documentation services for Telos, managing personas, profiles, and project documentation.

## Features

- **Persona Management**: Define and manage Telos personas
- **Profile Documentation**: Track Telos profile documentation
- **Project Documentation**: Maintain Telos project documentation

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `PersonaTelos`: Telos persona definitions and documentation
- `ProfileTelos`: Telos profile documentation
- `ProjectTelos`: Telos project documentation

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonaTelos } from './entities/persona-telos.entity';

@Injectable()
export class PersonaTelosService {
  constructor(
    @Inject(getRepositoryToken(PersonaTelos))
    private readonly personaRepo: Repository<PersonaTelos>,
  ) {}
}
```

## API Endpoints

### Personas
- `GET /persona-telos` - List all personas
- `GET /persona-telos/:id` - Get a specific persona
- `POST /persona-telos` - Create a new persona
- `PUT /persona-telos/:id` - Update a persona
- `DELETE /persona-telos/:id` - Delete a persona

### Profiles
- `GET /profile-telos` - List all profiles
- `GET /profile-telos/:id` - Get a specific profile
- `POST /profile-telos` - Create a new profile
- `PUT /profile-telos/:id` - Update a profile
- `DELETE /profile-telos/:id` - Delete a profile

### Projects
- `GET /project-telos` - List all projects
- `GET /project-telos/:id` - Get a specific project
- `POST /project-telos` - Create a new project
- `PUT /project-telos/:id` - Update a project
- `DELETE /project-telos/:id` - Delete a project

## Running the Application

### Development
```bash
nx serve telos-docs-service
```

### Production Build
```bash
nx build telos-docs-service
```

### Docker
The telos-docs-service is included in the main docker-compose stack:
```bash
docker-compose up telos-docs-service
```
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
