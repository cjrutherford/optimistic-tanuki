# Encryption

This library contains services for encrypting and decrypting data. It provides a simple and secure way to protect sensitive information.

## Usage

To use the services in this library, inject them into your NestJS services or controllers:

```typescript
import { EncryptionService } from '@optimistic-tanuki/encryption';

@Injectable()
export class MyService {
  constructor(private readonly encryptionService: EncryptionService) {}
}
```

## Running unit tests

Run `nx test encryption` to execute the unit tests.