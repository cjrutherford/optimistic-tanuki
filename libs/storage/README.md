# Storage

This library contains services for interacting with file storage. It provides a simple and consistent way to upload, download, and delete files.

## Usage

To use the services in this library, inject them into your NestJS services or controllers:

```typescript
import { StorageService } from '@optimistic-tanuki/storage';

@Injectable()
export class MyService {
  constructor(private readonly storageService: StorageService) {}
}
```

## Running unit tests

Run `nx test storage` to execute the unit tests.