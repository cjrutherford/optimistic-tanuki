# Project Planning

<<<<<<< HEAD
This service is responsible for managing projects, tasks, and other project-related data. It provides a flexible and powerful platform for planning and tracking projects of all sizes.

## 🚀 Getting Started

This service is started as part of the Forge of Will application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Project Planning service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/project-planning`.
=======
This project provides comprehensive tools for project planning, task management, risk assessment, and project tracking.

## Features

- **Project Management**: Create and manage projects with detailed information
- **Task Tracking**: Define and track project tasks
- **Time Management**: Track time spent on tasks with timers
- **Risk Management**: Identify and assess project risks
- **Change Management**: Track project changes and modifications
- **Project Journals**: Maintain project journals and notes

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `Project`: Project information and metadata
- `Task`: Project tasks and subtasks
- `Timer`: Time tracking for tasks
- `Risk`: Project risk assessment
- `Change`: Project change tracking
- `ProjectJournal`: Project journal entries and notes

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectService {
  constructor(
    @Inject(getRepositoryToken(Project))
    private readonly projectRepo: Repository<Project>,
  ) {}
}
```

## API Endpoints

### Projects
- `GET /projects` - List all projects
- `GET /projects/:id` - Get a specific project
- `POST /projects` - Create a new project
- `PUT /projects/:id` - Update a project
- `DELETE /projects/:id` - Delete a project

### Tasks
- `GET /tasks` - List all tasks
- `GET /tasks/:id` - Get a specific task
- `POST /tasks` - Create a new task
- `PUT /tasks/:id` - Update a task
- `DELETE /tasks/:id` - Delete a task

### Timers
- `POST /timers/start` - Start a timer for a task
- `POST /timers/stop` - Stop a running timer
- `GET /timers/:taskId` - Get timers for a task

### Risks
- `GET /risks/:projectId` - Get risks for a project
- `POST /risks` - Add a new risk
- `PUT /risks/:id` - Update a risk

### Changes
- `GET /changes/:projectId` - Get changes for a project
- `POST /changes` - Record a new change

### Project Journals
- `GET /journals/:projectId` - Get journal entries for a project
- `POST /journals` - Create a new journal entry

## Running the Application

### Development
```bash
nx serve project-planning
```

### Production Build
```bash
nx build project-planning
```

### Docker
The project-planning service is included in the Forge of Will docker-compose stack:
```bash
docker-compose -f fow.docker-compose.yaml up project-planning
```
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
