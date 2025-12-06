# API Base URL Configuration

## Overview

The `API_BASE_URL` injection token provides a centralized way to configure the base URL for API calls in Angular applications. This eliminates the need to hardcode the API base URL in each service.

## Why Use This?

- **Centralized Configuration**: Set the API base URL once in your app configuration
- **Environment Flexibility**: Easy to change for different environments (dev, staging, production)
- **Consistency**: All services use the same base URL pattern
- **Maintainability**: Update the base URL in one place instead of every service

## Usage

### 1. In App Configuration

Import the `API_BASE_URL` token from `@optimistic-tanuki/constants` and provide a value in your `app.config.ts`:

```typescript
import { ApplicationConfig } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/constants';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    {
      provide: API_BASE_URL,
      useValue: '/api',  // Static value
    },
    // OR use a factory for dynamic values:
    {
      provide: API_BASE_URL,
      useFactory: () => {
        return (window as any)['env']?.API_URL || '/api';
      },
    },
  ],
};
```

### 2. In Services

Inject the `API_BASE_URL` token in your service constructor:

```typescript
import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/constants';

@Injectable({
  providedIn: 'root'
})
export class MyService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/my-endpoint`;
  }

  getData() {
    return this.http.get(`${this.baseUrl}/data`);
  }
}
```

### 3. Using inject() Function (Modern Angular Pattern)

If you prefer using the `inject()` function:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/constants';

@Injectable({
  providedIn: 'root'
})
export class MyService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiBaseUrl}/my-endpoint`;

  getData() {
    return this.http.get(`${this.baseUrl}/data`);
  }
}
```

## Migration Guide

### Migrating Existing Services

To migrate an existing service that has hardcoded URLs:

**Before:**
```typescript
@Injectable({ providedIn: 'root' })
export class PostService {
  private baseUrl = '/api/social/post';

  constructor(private http: HttpClient) { }

  getPost(id: string) {
    return this.http.get(`${this.baseUrl}/${id}`);
  }
}
```

**After:**
```typescript
import { Inject } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/constants';

@Injectable({ providedIn: 'root' })
export class PostService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/social/post`;
  }

  getPost(id: string) {
    return this.http.get(`${this.baseUrl}/${id}`);
  }
}
```

## Example Implementations

### Client Interface App

The `client-interface` app has been configured to use the API_BASE_URL token. See:
- Configuration: `apps/client-interface/src/app/app.config.ts`
- Example services:
  - `apps/client-interface/src/app/post.service.ts`
  - `apps/client-interface/src/app/comment.service.ts`
  - `apps/client-interface/src/app/authentication.service.ts`
  - `apps/client-interface/src/app/profile.service.ts`

### Forge of Will App

To configure the `forgeofwill` app, update `apps/forgeofwill/src/app/app.config.ts`:

```typescript
import { API_BASE_URL } from '@optimistic-tanuki/constants';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers
    {
      provide: API_BASE_URL,
      useValue: '/api',
    },
  ],
};
```

Then update services like `ProjectService`:

```typescript
// Before
baseUrl = '/api/project-planning/projects'

// After
private baseUrl: string;

constructor(
  @Inject(API_BASE_URL) private apiBaseUrl: string,
  // ... other dependencies
) {
  this.baseUrl = `${this.apiBaseUrl}/project-planning/projects`;
}
```

## Best Practices

1. **Always provide the token**: Each Angular application must provide a value for `API_BASE_URL` in its configuration
2. **Don't include trailing slashes**: Configure the base URL without a trailing slash (e.g., `/api` not `/api/`)
3. **Build URLs consistently**: Always use template literals to build full URLs: `` `${this.apiBaseUrl}/endpoint` ``
4. **Use environment-specific values**: Consider using a factory function to provide different URLs for different environments
5. **Document your endpoints**: Keep track of which services use which endpoints for easier maintenance

## Testing

When writing tests for services that use `API_BASE_URL`, provide a mock value:

```typescript
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/constants';
import { MyService } from './my.service';

describe('MyService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: API_BASE_URL,
          useValue: '/api',
        },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(MyService);
    expect(service).toBeTruthy();
  });
});
```

## Troubleshooting

### Error: NullInjectorError: No provider for InjectionToken API_BASE_URL

This means you forgot to provide a value for `API_BASE_URL` in your app configuration. Add it to your `app.config.ts` providers array.

### Services still using hardcoded URLs

Make sure to:
1. Import `API_BASE_URL` from `@optimistic-tanuki/constants`
2. Inject it in the constructor or using `inject()`
3. Use the injected value to build your URLs

## Related Files

- Token definition: `libs/constants/src/lib/libs/api-config.tokens.ts`
- Export: `libs/constants/src/index.ts`
- Example configuration: `apps/client-interface/src/app/app.config.ts`
