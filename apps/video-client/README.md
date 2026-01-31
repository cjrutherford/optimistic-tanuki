# Video Client

An Angular application for the video streaming platform, providing a YouTube-like experience for watching, uploading, and discovering videos.

## Features

### Pages

#### Home Page (`/`)
- Displays recommended videos based on views and likes
- Shows trending videos from the last 7 days
- Responsive video grid layout
- Click on any video to watch

#### Watch Page (`/watch/:id`)
- HTML5 video player with full controls
- Video metadata (views, date, likes)
- Like/unlike functionality
- Share video link (copy to clipboard)
- Channel information with subscribe button
- View tracking (increments on play)

#### Channel Page (`/channel/:id`)
- Channel header with banner and avatar
- Subscribe/unsubscribe button
- Grid of all channel videos
- Channel description and subscriber count

#### Upload Page (`/upload`)
- Video file upload (MP4, WebM, MOV up to 500MB)
- Thumbnail upload (optional)
- Video metadata form (title, description)
- Channel selection
- Visibility settings (public/unlisted/private)
- Upload progress indicator

### Components

All UI components are imported from the `@optimistic-tanuki/video-ui` library:
- `VideoPlayerComponent`: HTML5 video player
- `ChannelHeaderComponent`: Channel display with subscribe button
- `VideoCardComponent`: Video thumbnail cards
- `VideoGridComponent`: Responsive grid layout

### Services

#### VideoService
Handles all API calls to the video backend:

```typescript
// Video operations
getVideos(): Observable<Video[]>
getVideo(id: string): Observable<Video>
getRecommendedVideos(limit?: number): Observable<Video[]>
getTrendingVideos(limit?: number): Observable<Video[]>
getChannelVideos(channelId: string): Observable<Video[]>
createVideo(video: CreateVideoDto): Observable<Video>
incrementViewCount(videoId: string): Observable<void>
likeVideo(videoId: string): Observable<void>
unlikeVideo(videoId: string): Observable<void>

// Channel operations
getChannels(): Observable<Channel[]>
getChannel(id: string): Observable<Channel>
getUserChannels(userId: string): Observable<Channel[]>
createChannel(channel: CreateChannelDto): Observable<Channel>

// Subscription operations
subscribeToChannel(subscription: SubscribeDto): Observable<ChannelSubscription>
unsubscribeFromChannel(channelId: string, userId: string): Observable<void>
getUserSubscriptions(userId: string): Observable<ChannelSubscription[]>
getChannelSubscribers(channelId: string): Observable<ChannelSubscription[]>
```

## Development

### Running Locally

```bash
# Start the app
nx serve video-client

# Build for production
nx build video-client --configuration=production

# Run tests
nx test video-client

# Lint
nx lint video-client
```

The app will be available at `http://localhost:4200`

### API Proxy

The app uses a proxy configuration (`proxy.conf.json`) to forward API requests to the gateway:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

## Docker Deployment

### Build and Run

```bash
# Build the Docker image
docker build -t video-client -f apps/video-client/Dockerfile .

# Run the container
docker run -p 8086:4000 video-client

# Or use docker-compose
docker-compose up -d video-client
```

The app will be available at `http://localhost:8086`

### Environment Variables

- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment mode (production/development)

## Architecture

### Server-Side Rendering (SSR)

The app uses Angular Universal for SSR:
- Faster initial page load
- Better SEO for public videos
- Social media preview support

### Routing

```
/                    → Home page (recommended videos)
/watch/:id           → Watch video page
/channel/:id         → Channel page
/upload              → Upload video page
```

### State Management

Currently using simple service-based state management:
- VideoService holds API logic
- Components manage local state
- Could be enhanced with NgRx or similar

## Integration

### Backend Services

The app integrates with:

1. **Gateway** (`http://localhost:3000/api`)
   - Routes all API requests
   - Handles authentication

2. **Videos Service** (via gateway)
   - Video CRUD operations
   - Channel management
   - Subscriptions
   - View tracking

3. **Asset Service** (via gateway)
   - Video file storage
   - Thumbnail storage
   - File streaming

## Future Enhancements

### Planned Features
- [ ] User authentication integration
- [ ] Search functionality
- [ ] Comments section (integrate with social service)
- [ ] Playlists
- [ ] Watch history
- [ ] Video editing (title, description, thumbnail)
- [ ] Analytics dashboard for creators
- [ ] Live streaming support
- [ ] Multiple quality options (360p, 720p, 1080p)

### Performance Optimizations
- [ ] Lazy loading for video grid
- [ ] Infinite scroll
- [ ] Image optimization
- [ ] Video preloading
- [ ] Service worker for offline support

## Testing

```bash
# Unit tests
nx test video-client

# E2E tests
nx e2e video-client-e2e

# Coverage
nx test video-client --coverage
```

## Contributing

When adding new features:

1. Follow Angular style guide
2. Use standalone components
3. Import from video-ui library when possible
4. Add TypeScript types
5. Write tests
6. Update this README

## License

Part of the Optimistic Tanuki project.
