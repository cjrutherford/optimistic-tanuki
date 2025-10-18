# Prompt Generation

This library contains services for generating prompts for AI models. It provides a flexible and extensible way to create prompts that are tailored to specific tasks and domains.

## Usage

To use the services in this library, inject them into your NestJS services or controllers:

```typescript
import { PromptGenerationService } from '@optimistic-tanuki/prompt-generation';

@Injectable()
export class MyService {
  constructor(private readonly promptGenerationService: PromptGenerationService) {}
}
```

## Running unit tests

Run `nx test prompt-generation` to execute the unit tests.