# Video Streaming Platform

A YouTube-like video streaming platform built with NestJS, Angular, and TypeORM, integrated into the Optimistic Tanuki ecosystem.

## Features

### Backend Services

#### Video Service (`apps/videos`)
A microservice handling all video-related operations:

**Entities:**
- **Channel**: Content creator channels with profile associations
- **Video**: Video content with metadata (duration, resolution, encoding)
- **ChannelSubscription**: User subscriptions to channels
- **VideoView**: Analytics for tracking video views and watch duration

**Key Features:**
- CRUD operations for channels and videos
- Channel subscription management
- Video view tracking
- Recommendation engine (based on views and likes)
- Trending videos algorithm
- Public/unlisted/private visibility controls

**API Endpoints** (via Gateway):
- `GET /videos` - List all public videos
- `GET /videos/recommended` - Get recommended videos
- `GET /videos/trending` - Get trending videos
- `GET /videos/:id` - Get video details
- `POST /videos` - Create a new video (authenticated)
- `PUT /videos/:id` - Update video (authenticated)
- `DELETE /videos/:id` - Delete video (authenticated)
- `GET /videos/channels` - List all channels
- `POST /videos/channels` - Create a channel (authenticated)
- `GET /videos/channels/:id` - Get channel details
- `POST /videos/subscriptions` - Subscribe to a channel (authenticated)
- `DELETE /videos/subscriptions/:channelId` - Unsubscribe from channel (authenticated)

### Frontend Components

#### Video UI Library (`libs/video-ui`)
Reusable Angular components for video playback and display:

**Components:**
- **VideoPlayerComponent**: HTML5 video player with controls
  - Features: play, pause, seek, duration display
  - Events: play, pause, ended, timeUpdate
  - Methods: playVideo(), pauseVideo(), seekTo()

- **ChannelHeaderComponent**: Display channel information
  - Shows channel banner, avatar, name, description
  - Subscriber count display
  - Subscribe/Unsubscribe button

- **VideoCardComponent**: Video thumbnail preview
  - Thumbnail with duration overlay
  - Video title, channel name
  - View count and time ago display
  - Click event handling

- **VideoGridComponent**: Responsive grid layout
  - Displays multiple video cards in a grid
  - Responsive design (adapts to mobile)

## Architecture

### Database Schema

```typescript
Channel {
  id: string (UUID)
  name: string
  description: string
  profileId: string
  userId: string
  bannerAssetId: string
  avatarAssetId: string
  createdAt: Date
  updatedAt: Date
}

Video {
  id: string (UUID)
  title: string
  description: string
  assetId: string // Reference to asset service
  thumbnailAssetId: string
  channelId: string
  durationSeconds: number
  resolution: string (e.g., "1920x1080")
  encoding: string (e.g., "H.264")
  viewCount: number
  likeCount: number
  visibility: 'public' | 'unlisted' | 'private'
  createdAt: Date
  updatedAt: Date
  publishedAt: Date
}

ChannelSubscription {
  id: string (UUID)
  channelId: string
  userId: string
  profileId: string
  subscribedAt: Date
}

VideoView {
  id: string (UUID)
  videoId: string
  userId: string (optional)
  profileId: string (optional)
  ipAddress: string (optional)
  watchDurationSeconds: number
  viewedAt: Date
}
```

### Service Communication

```
Client (Angular) 
  ↓ HTTP
Gateway Service (:3000)
  ↓ TCP Microservices
Videos Service (:3009)
  ↓ Database Queries
PostgreSQL (videos database)
```

### Integration Points

1. **Asset Service**: Videos reference assets for video files and thumbnails
2. **Profile Service**: Channels are associated with user profiles
3. **Authentication Service**: Gateway validates user sessions
4. **Social Service**: Can be integrated for comments, likes, and shares

## Usage

### Running the Video Service

#### Development
```bash
# Start the service
nx serve videos

# Run with watch mode
nx serve videos --watch
```

#### Docker
```bash
# Build and start all services
docker-compose up -d

# Or just the videos service
docker-compose up -d videos
```

### Seeding Sample Data

```bash
# Run the seed script
nx run videos:seed

# Or with Docker
docker-compose exec videos node seed-videos.js
```

Sample data includes:
- 3 Channels (Tech Tutorials, Cooking Adventures, Fitness & Health)
- 7 Videos with realistic metadata
- Sample subscriptions

### Using the UI Components

```typescript
import { 
  VideoPlayerComponent, 
  ChannelHeaderComponent, 
  VideoCardComponent, 
  VideoGridComponent 
} from '@optimistic-tanuki/video-ui';

// In your component
@Component({
  selector: 'app-video-page',
  template: `
    <video-player 
      [videoUrl]="videoUrl"
      [title]="videoTitle"
      (play)="onVideoPlay()"
      (ended)="onVideoEnded()"
    ></video-player>
    
    <video-grid 
      [videos]="videos"
      (videoClick)="navigateToVideo($event)"
    ></video-grid>
  `
})
```

## Configuration

### Environment Variables

Video service supports the following environment variables:

- `PORT` - Service port (default: 3009)
- `POSTGRES_HOST` - Database host (default: localhost)
- `POSTGRES_PORT` - Database port (default: 5432)
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name (default: videos)

### Gateway Configuration

Add to `apps/gateway/src/assets/config.yaml`:

```yaml
services:
  videos:
    name: videos
    transport: TCP
    host: ot_videos
    port: 3009
```

## Development Roadmap

### Completed ✅
- Video service backend with full CRUD
- Channel management
- Subscription system
- View tracking
- Recommendation algorithm
- UI component library
- Docker deployment
- Seed data

### Planned 📋
- Frontend client application
- Video upload integration with asset service
- Thumbnail generation
- Enhanced recommendation algorithm (ML-based)
- Comments integration with social service
- Like/share functionality
- Search and filtering
- Playlists
- Watch history
- Analytics dashboard

## Testing

```bash
# Run unit tests
nx test videos
nx test video-ui

# Run e2e tests
nx e2e videos-e2e

# Run specific test suite
nx test videos --test-file=channel.service.spec.ts
```

## API Examples

### Creating a Channel
```bash
curl -X POST http://localhost:3000/videos/channels \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Channel",
    "description": "A great channel",
    "profileId": "uuid",
    "userId": "uuid"
  }'
```

### Getting Recommended Videos
```bash
curl http://localhost:3000/videos/recommended?limit=10
```

### Subscribing to a Channel
```bash
curl -X POST http://localhost:3000/videos/subscriptions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "uuid",
    "userId": "uuid",
    "profileId": "uuid"
  }'
```

## Contributing

When contributing to the video platform:

1. Follow existing patterns from other services (store, social, etc.)
2. Use TypeORM entities with proper relationships
3. Include DTOs for validation
4. Add seed data for new features
5. Write tests for services and components
6. Update this README with new features

## License

Part of the Optimistic Tanuki project.
