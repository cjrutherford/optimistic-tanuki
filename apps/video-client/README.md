# Video Client

A complete Angular application for the video streaming platform, providing a YouTube-like experience with authentication, profile management, and social features.

## Features

### Authentication & User Management
- **Registration**: Create new accounts with email/password
- **Login**: Secure JWT-based authentication
- **Profile Management**: Create and manage multiple profiles
- **Session Management**: Automatic token storage and refresh

### Pages

#### Home Page (`/`)
- Displays recommended videos based on views and likes
- Shows trending videos from the last 7 days
- Responsive video grid layout
- Public access (no login required)

#### Watch Page (`/watch/:id`)
- HTML5 video player with full controls
- Video metadata (views, date, likes)
- Like/unlike functionality
- Share video link (copy to clipboard)
- Channel information with subscribe button
- View tracking (increments on play)
- Public access

#### Channel Page (`/channel/:id`)
- Channel header with banner and avatar
- Subscribe/unsubscribe button
- Grid of all channel videos
- Channel description and subscriber count
- Public access

#### My Channel Page (`/my-channel`) - Protected
- Manage your own channel
- **Videos Tab**: View all your uploaded videos with upload button
- **Analytics Tab**: View channel statistics (total views, video count, subscribers)
- **Settings Tab**: Channel settings (coming soon)
- Create channel button if you don't have one

#### Upload Page (`/upload`) - Protected
- Video file upload (MP4, WebM, MOV up to 500MB)
- Thumbnail upload (optional)
- Video metadata form (title, description)
- Channel selection
- Visibility settings (public/unlisted/private)
- Upload progress indicator
- Requires authentication

#### Profile Settings (`/profile`) - Protected
- View current profile
- Switch between profiles
- Profile avatar display
- Requires authentication

#### Watch History (`/history`) - Protected
- View all previously watched videos
- Watch timestamps
- Continue watching from where you left off
- Requires authentication

#### Login Page (`/login`)
- Email/password login form
- Redirect to profile creation if needed
- Integration with auth-ui library

#### Register Page (`/register`)
- User registration form
- Email, password, name, and bio fields
- Automatic redirect to login after registration

### Navigation

#### App Bar (Top Navigation)
- Platform logo and title
- Theme toggle button (light/dark mode)
- Menu toggle for sidebar
- Responsive design

#### Sidebar Navigation (Collapsible)
**When Not Authenticated:**
- Home
- Login
- Register

**When Authenticated:**
- Home
- My Channel
- Upload
- History
- Profile
- Logout

### Components

All UI components follow the workspace theming patterns:

**From `@optimistic-tanuki/video-ui`:**
- `VideoPlayerComponent`: HTML5 video player with theme support
- `ChannelHeaderComponent`: Channel display with dynamic theme colors
- `VideoCardComponent`: Video thumbnail cards with theme-aware styling
- `VideoGridComponent`: Responsive grid layout

**From `@optimistic-tanuki/navigation-ui`:**
- `AppBarComponent`: Top navigation bar
- `NavSidebarComponent`: Collapsible sidebar menu

**From `@optimistic-tanuki/auth-ui`:**
- `LoginBlockComponent`: Login form
- `RegisterBlockComponent`: Registration form

### Services

#### VideoService
Handles all API calls to the video backend:

```typescript
// Video operations
getVideos(): Observable<VideoDto[]>
getVideo(id: string): Observable<VideoDto>
getRecommendedVideos(limit?: number): Observable<VideoDto[]>
getTrendingVideos(limit?: number): Observable<VideoDto[]>
getChannelVideos(channelId: string): Promise<VideoDto[]>
createVideo(video: CreateVideoDto): Observable<VideoDto>
incrementViewCount(videoId: string): Observable<void>
likeVideo(videoId: string): Observable<void>
unlikeVideo(videoId: string): Observable<void>

// Channel operations
getChannels(): Observable<ChannelDto[]>
getChannel(id: string): Observable<ChannelDto>
getUserChannels(userId: string): Observable<ChannelDto[]>
getMyChannels(): Promise<ChannelDto[]>
createChannel(channel: CreateChannelDto): Promise<ChannelDto>

// Subscription operations
subscribeToChannel(subscription: SubscribeDto): Observable<ChannelSubscriptionDto>
unsubscribeFromChannel(channelId: string, userId: string): Observable<void>
getUserSubscriptions(userId: string): Observable<ChannelSubscriptionDto[]>
getChannelSubscribers(channelId: string): Observable<ChannelSubscriptionDto[]>
```

#### AuthStateService
Manages authentication state and JWT tokens:

```typescript
login(loginRequest: LoginRequest): Promise<LoginResponse>
setToken(token: string): void
getToken(): string | null
logout(): void
isAuthenticated: boolean
getDecodedTokenValue(): DecodedToken | null
```

#### AuthenticationService
Handles user registration and account management:

```typescript
register(registerRequest: RegisterRequest): Observable<any>
confirmEmail(token: string): Observable<any>
forgotPassword(email: string): Observable<any>
resetPassword(token: string, newPassword: string): Observable<any>
```

#### ProfileService
Manages user profiles:

```typescript
getAllProfiles(): Promise<ProfileDto[]>
getProfileById(id: string): Promise<ProfileDto>
createProfile(profile: Partial<ProfileDto>): Promise<ProfileDto>
updateProfile(id: string, profile: Partial<ProfileDto>): Promise<ProfileDto>
selectProfile(profile: ProfileDto): void
getCurrentUserProfile(): ProfileDto | null
getCurrentUserProfiles(): ProfileDto[]
loadStoredProfile(): void
```

### Guards & Interceptors

#### AuthGuard
Protects routes that require authentication. Redirects to `/login` if not authenticated.

#### AuthInterceptor
Automatically adds JWT token to all HTTP requests in the `Authorization` header.

### Theme Integration

The video-client uses the `@optimistic-tanuki/theme-lib` with:
- **Default Palette**: "Sunset Vibes"
- **Theme Toggle**: Available in app bar
- **Dynamic Theming**: All video-ui components respond to theme changes
- **Persistent**: Theme preferences stored in localStorage

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
