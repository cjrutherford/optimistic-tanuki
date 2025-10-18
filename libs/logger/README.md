# Logger

This library contains a service for logging messages to the console and other output streams. It provides a flexible and configurable way to log messages at different levels of severity.

## Usage

To use the service in this library, inject it into your NestJS services or controllers:

```typescript
import { LoggerService } from '@optimistic-tanuki/logger';

@Injectable()
export class MyService {
  constructor(private readonly loggerService: LoggerService) {}
}
```

## Running unit tests

Run `nx test logger` to execute the unit tests.