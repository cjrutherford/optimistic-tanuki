# Video Client E2E Tests

End-to-end tests for the video streaming platform using Playwright.

## Overview

This test suite validates the complete video platform workflow including:
1. Creating a channel
2. Posting/uploading a video
3. Updating a video
4. Writing comments on videos and channels
5. Following/subscribing to channels
6. Playing videos
7. UI navigation and components

## Test Architecture

- **Framework**: Playwright
- **Backend**: Real services via Docker Compose
- **Frontend**: video-client Angular app
- **Pattern**: Integration tests with real API calls

## Running Tests

### Quick Start

```bash
# Run all e2e tests with Docker
nx run video-client-e2e:e2e-docker

# This will:
# 1. Start all backend services
# 2. Wait for services to stabilize
# 3. Run the e2e tests
# 4. Tear down services
```

### Manual Steps

```bash
# Start backend services
nx run video-client-e2e:up

# Wait for services (45 seconds)
sleep 45

# Run tests
nx run video-client-e2e:e2e

# Stop services
nx run video-client-e2e:down
```

### Individual Tests

```bash
# Run specific test file
pnpm exec playwright test apps/video-client-e2e/src/video-platform.spec.ts

# Run with UI
pnpm exec playwright test apps/video-client-e2e/src/video-platform.spec.ts --ui

# Run in debug mode
pnpm exec playwright test apps/video-client-e2e/src/video-platform.spec.ts --debug
```

## Test Workflows

### 1. Channel Creation
- Creates a test channel via API
- Verifies channel page loads
- Checks channel header displays

### 2. Video Upload
- Creates mock video asset
- Posts video to channel
- Verifies video appears on channel

### 3. Video Update
- Updates video metadata (title, description)
- Verifies changes are reflected

### 4. Video Playback
- Navigates to watch page
- Loads video player
- Checks for HTML5 video element
- Displays video metadata

### 5. Comments
- Posts comment on video (via social API)
- Posts comment on channel (via social API)
- Tests social integration

### 6. Subscriptions
- Subscribes to channel via API
- Verifies subscribe button on UI
- Tests channel subscription flow

### 7. Video Interactions
- Like/unlike videos
- Share video links
- View tracking

## Test Data

Tests use timestamped data to avoid conflicts:
```typescript
const testChannel = {
  name: `E2E Test Channel ${Date.now()}`,
  description: 'E2E test channel'
};

const testVideo = {
  title: `E2E Test Video ${Date.now()}`,
  description: 'E2E test video'
};
```

## Services Required

The e2e tests require these backend services:
- PostgreSQL database
- Authentication service
- Profile service
- Permissions service
- Asset service
- Social service
- Videos service
- Gateway
- Video-client (frontend)

All services are orchestrated via Docker Compose.

## Configuration

### Playwright Config
- Base URL: `http://localhost:8086`
- Browsers: Chromium, Firefox, WebKit
- Timeout: 10-15 seconds for most operations
- Retries: Configured in playwright.config.ts

### Docker Compose
- File: `e2e/docker-compose.video-client-e2e.yaml`
- Port: 8086 (video-client)
- Gateway: 3000
- Videos service: 3016

## Troubleshooting

### Tests Fail with Timeout
```bash
# Increase wait time in global-setup.ts
# Or manually wait longer before running tests
sleep 60
nx run video-client-e2e:e2e
```

### Backend Services Not Starting
```bash
# Check logs
docker compose -f e2e/docker-compose.video-client-e2e.yaml logs

# Rebuild specific service
docker compose -f e2e/docker-compose.video-client-e2e.yaml up -d --build gateway
```

### Database Issues
```bash
# Clean up and restart
nx run video-client-e2e:down
docker volume prune
nx run video-client-e2e:up
```

### Port Conflicts
```bash
# Check if ports are in use
lsof -i :8086
lsof -i :3000

# Kill conflicting processes or change ports in docker-compose
```

## Test Reports

After running tests:
```bash
# View HTML report
pnpm exec playwright show-report

# Report location
dist/.playwright/apps/video-client-e2e/playwright-report
```

## CI/CD Integration

For continuous integration:
```bash
# Set BASE_URL for deployed app
BASE_URL=https://video.example.com nx run video-client-e2e:e2e

# Or use CI configuration
nx run video-client-e2e:e2e:ci
```

## Development

### Adding New Tests

1. Create test in `src/` directory
2. Follow naming: `*.spec.ts`
3. Use existing patterns from `video-platform.spec.ts`
4. Group related tests with `test.describe()`
5. Use serial mode for dependent tests

### Best Practices

- Use `test.describe.configure({ mode: 'serial' })` for dependent tests
- Wait for API responses with timeouts
- Handle both success and error cases
- Use meaningful test data
- Add console.log for debugging
- Clean up test data when possible

## Known Limitations

1. **Asset Upload**: Uses mock base64 content (real video upload not tested)
2. **Authentication**: Uses test user IDs (no real login flow)
3. **Comments Display**: Tests API integration but not UI rendering
4. **Video Playback**: Tests player loading but not actual video streaming

## Future Enhancements

- [ ] Test real video file upload
- [ ] Add authentication flow tests
- [ ] Test comment UI rendering
- [ ] Test video quality selection
- [ ] Test playlist functionality
- [ ] Test search and filtering
- [ ] Add performance tests
- [ ] Add accessibility tests
