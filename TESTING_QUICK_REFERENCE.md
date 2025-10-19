# E2E Testing Quick Reference

Quick reference card for running and writing E2E tests in the Optimistic Tanuki workspace.

## Quick Commands

### Run All Tests
```bash
nx run-many --target=e2e --all
```

### Run Specific Test Suites

#### Microservices
```bash
nx e2e authentication-e2e  # Port 3001
nx e2e profile-e2e         # Port 3002
nx e2e social-e2e          # Port 3003
nx e2e assets-e2e          # Port 3005
nx e2e blogging-e2e        # Port 3011
```

#### Gateway
```bash
nx e2e gateway-e2e         # Port 3000
```

#### UI Applications
```bash
nx e2e client-interface-e2e
nx e2e forgeofwill-e2e
nx e2e digital-homestead-e2e
nx e2e christopherrutherford-net-e2e
```

### Development Mode
```bash
nx e2e authentication-e2e --watch
```

### CI Mode (with coverage)
```bash
nx e2e authentication-e2e --configuration=ci
```

## Test Patterns

### Microservice Test (TCP)

```typescript
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { YourCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Your Service E2E', () => {
  let client: ClientProxy;

  beforeAll(async () => {
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: YOUR_PORT,
      },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it('should test command', async () => {
    const result = await firstValueFrom(
      client.send({ cmd: YourCommands.COMMAND }, payload)
    );
    expect(result).toBeDefined();
  });
});
```

### Gateway Test (HTTP)

```typescript
import axios from 'axios';

describe('Endpoint Tests', () => {
  const api = axios.create({
    baseURL: 'http://localhost:3000/api',
    validateStatus: () => true,
  });

  it('should test endpoint', async () => {
    const res = await api.post('/your-endpoint', data);
    expect(res.status).toBe(201);
    expect(res.data).toBeDefined();
  });
});
```

### Playwright Test (UI)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Tests', () => {
  test('should test feature', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const element = await page.locator('selector');
    expect(await element.isVisible()).toBe(true);
  });
});
```

## Common Assertions

### Microservices
```typescript
// Basic assertions
expect(result).toBeDefined();
expect(result.id).toBeDefined();
expect(result.field).toBe('value');
expect(Array.isArray(result)).toBe(true);
expect(result.length).toBeGreaterThan(0);

// Error handling
try {
  await firstValueFrom(client.send(...));
  fail('Should have thrown an error');
} catch (error) {
  expect(error).toBeDefined();
}
```

### Gateway
```typescript
// HTTP status
expect(res.status).toBe(200);
expect(res.status).toBe(201);
expect(res.status).toBe(500);

// Response data
expect(res.data).toBeDefined();
expect(res.data.token).toBeDefined();
expect(res.data).toEqual(expectedData);
```

### Playwright
```typescript
// Element visibility
expect(await element.isVisible()).toBe(true);
expect(await element.count()).toBeGreaterThan(0);

// Page state
await expect(page).toHaveTitle(/Expected Title/);
await expect(page).toHaveURL(/expected-url/);

// Element text
await expect(element).toContainText('Expected text');
```

## Service Ports

| Service | Port | Type |
|---------|------|------|
| Gateway | 3000 | HTTP |
| Authentication | 3001 | TCP |
| Profile | 3002 | TCP |
| Social | 3003 | TCP |
| Assets | 3005 | TCP |
| Blogging | 3011 | TCP |

## Available Commands (Constants)

### Authentication
```typescript
AuthCommands.Login
AuthCommands.Register
AuthCommands.Validate
AuthCommands.ResetPassword
AuthCommands.EnableMultiFactor
AuthCommands.ValidateTotp
```

### Profile
```typescript
ProfileCommands.Create
ProfileCommands.Get
ProfileCommands.GetAll
ProfileCommands.Update
ProfileCommands.Delete
```

### Social
```typescript
PostCommands.CREATE
PostCommands.FIND
PostCommands.FIND_MANY
PostCommands.UPDATE
PostCommands.DELETE

CommentCommands.CREATE
CommentCommands.FIND
CommentCommands.FIND_MANY
CommentCommands.UPDATE
CommentCommands.DELETE

VoteCommands.UPVOTE
VoteCommands.DOWNVOTE
VoteCommands.UNVOTE
VoteCommands.GET

FollowCommands.FOLLOW
FollowCommands.UNFOLLOW
FollowCommands.GET_FOLLOWERS
FollowCommands.GET_FOLLOWING
FollowCommands.GET_MUTUALS
FollowCommands.GET_FOLLOWER_COUNT
FollowCommands.GET_FOLLOWING_COUNT
```

### Assets
```typescript
AssetCommands.CREATE
AssetCommands.RETRIEVE
AssetCommands.READ
AssetCommands.REMOVE
```

### Blogging
```typescript
BlogPostCommands.CREATE
BlogPostCommands.FIND
BlogPostCommands.FIND_ALL
BlogPostCommands.UPDATE
BlogPostCommands.DELETE

EventCommands.CREATE
EventCommands.FIND
EventCommands.FIND_ALL
EventCommands.UPDATE
EventCommands.DELETE
```

## Troubleshooting

### Common Issues

**Connection Refused**
- Ensure Docker containers are running
- Check if the port is correct
- Verify service is started

**Test Timeout**
- Increase timeout in jest config
- Check if services are responding
- Verify network connectivity

**Import Errors**
- Ensure `@optimistic-tanuki/*` paths are correct
- Check if constants are exported properly
- Verify tsconfig.json paths

**Docker Issues**
- Run `docker-compose down` to clean up
- Check Docker logs: `docker-compose logs service-name`
- Ensure ports are not already in use

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Unique Data**: Use timestamps for unique test data
4. **Wait Properly**: Use proper wait conditions, not arbitrary delays
5. **Meaningful Names**: Use descriptive test names
6. **Error Testing**: Test both success and failure cases
7. **Documentation**: Document complex test scenarios

## Resources

- [Full E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [Test Coverage Report](./TEST_COVERAGE.md)
- [Playwright Docs](https://playwright.dev/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
