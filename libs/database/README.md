# Database

This library contains services and entities for interacting with the database. It provides a convenient and consistent way to access and manipulate data.

## Usage

To use the services in this library, inject them into your NestJS services or controllers:

```typescript
import { DatabaseService } from '@optimistic-tanuki/database';

@Injectable()
export class MyService {
  constructor(private readonly databaseService: DatabaseService) {}
}
```

## Running unit tests

Run `nx test database` to execute the unit tests.