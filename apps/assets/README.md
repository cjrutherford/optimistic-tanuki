# Assets

<<<<<<< HEAD
This service is responsible for managing digital assets, such as images, videos, and documents. It provides a centralized location for storing and retrieving assets, as well as for performing various operations on them, such as resizing and cropping images.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 📝 API Reference

The Assets service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/assets`.
=======
This project manages static assets such as images, fonts, and other media files. It provides a centralized location for storing and serving these assets across different applications within the workspace.

## Features

- **Asset Storage**: Upload and store various types of media files
- **Asset Retrieval**: Serve assets via HTTP endpoints
- **Storage Adapters**: Support for local file storage (with extensible adapter pattern)
- **Asset Metadata**: Track asset information in database

## Database

This application uses the `@optimistic-tanuki/database` module for database connectivity. The database connection and all entity repositories are automatically configured through the `DatabaseModule.register()` call in the app module.

### Entities

- `AssetEntity`: Asset metadata and file references

### Repository Injection

Repositories are automatically provided by the DatabaseModule. To use them in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AssetEntity from './entities/asset.entity';

@Injectable()
export class AssetService {
  constructor(
    @Inject(getRepositoryToken(AssetEntity))
    private readonly assetRepo: Repository<AssetEntity>,
  ) {}
}
```

## Dependencies

- `@optimistic-tanuki/storage`: Storage module for handling file uploads and retrieval

## Storage Configuration

The service uses the StorageModule with the following default configuration:
```typescript
StorageModule.register({
  enabledAdapters: ['local'],
  localStoragePath: './storage',
})
```

## API Endpoints

### Assets
- `POST /assets` - Upload a new asset
- `GET /assets/:id` - Retrieve an asset by ID
- `GET /assets` - List all assets
- `DELETE /assets/:id` - Delete an asset

## Running the Application

### Development
```bash
nx serve assets
```

### Production Build
```bash
nx build assets
```

### Docker
The assets service is included in the main docker-compose stack:
```bash
docker-compose up assets
```

## Storage Directory

By default, assets are stored in the `./storage` directory relative to the application root. Ensure this directory has appropriate read/write permissions.
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
