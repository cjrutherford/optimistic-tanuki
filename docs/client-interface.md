# Client Interface - Feature Overview

The Client Interface is a modern Angular-based social network application that provides a comprehensive set of features for social networking. It is built using a modular architecture with shared libraries for consistent UI and behavior across the platform.

## Architecture

### Tech Stack

- **Frontend Framework**: Angular 17+ (Standalone Components)
- **UI Libraries**: Custom design system built on `@optimistic-tanuki` libraries
- **State Management**: Angular Signals
- **Real-time**: WebSocket connections for live features
- **Styling**: SCSS with CSS custom properties for theming

### Key Libraries

| Library                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `@optimistic-tanuki/common-ui`       | Reusable UI components (buttons, cards, modals, etc.) |
| `@optimistic-tanuki/theme-lib`       | Theme management and design tokens                    |
| `@optimistic-tanuki/theme-ui`        | Theme customization UI components                     |
| `@optimistic-tanuki/form-ui`         | Form components (inputs, selects, etc.)               |
| `@optimistic-tanuki/navigation-ui`   | Navigation components (toolbar, sidebar)              |
| `@optimistic-tanuki/chat-ui`         | Chat and messaging components                         |
| `@optimistic-tanuki/notification-ui` | Notification components                               |
| `@optimistic-tanuki/search-ui`       | Search and discovery components                       |
| `@optimistic-tanuki/message-ui`      | Toast messages and notifications                      |
| `@optimistic-tanuki/social-ui`       | Social network specific components                    |
| `@optimistic-tanuki/community-ui`    | Community management components                       |
| `@optimistic-tanuki/profile-ui`      | Profile management components                         |
| `@optimistic-tanuki/blogging-ui`     | Blog and article components                           |
| `@optimistic-tanuki/project-ui`      | Project management components                         |
| `@optimistic-tanuki/forum-ui`        | Forum and discussion components                       |

## Features

### Core Features

1. **Authentication & User Management**

   - User registration and login
   - Profile management
   - Session handling with JWT

2. **News Feed**

   - Personalized feed based on followed users and communities
   - Post creation with text, images, and attachments
   - Like, comment, and share functionality
   - Infinite scroll for seamless browsing

3. **Notifications**

   - Real-time notifications for likes, comments, follows, and mentions
   - Notification bell with unread count
   - Full notification history page

4. **Search & Discovery**

   - Global search across users, posts, and communities
   - Explore page for discovering new content
   - Trending topics and suggested users

5. **Messaging**

   - Direct messaging between users
   - Real-time chat with typing indicators
   - Read receipts and online status
   - Message reactions

6. **Privacy & Safety**

   - Block and mute users
   - Content reporting
   - Privacy settings

7. **Profile & Analytics**

   - Profile viewing and editing
   - Profile view analytics
   - Activity history

8. **Communities**
   - Create and join communities
   - Community posts and discussions
   - Member management

### Enhanced Features

9. **Content Types**

   - Polls/surveys
   - Events
   - Scheduled posts
   - Post sharing

10. **Accessibility**

    - ARIA labels and live regions
    - Keyboard navigation
    - Focus management
    - Screen reader support

11. **Error Handling**
    - Unified HTTP error handling
    - Global error handler
    - User-friendly error messages

## Routes

| Path               | Component         | Description          |
| ------------------ | ----------------- | -------------------- |
| `/`                | LandingComponent  | Landing page         |
| `/login`           | LoginComponent    | User login           |
| `/register`        | User registration |
| `/feed`            | Feed              | Main news feed       |
| `/explore`         | Explore           | Discovery page       |
| `/messages`        | Messages          | Chat conversations   |
| `/notifications`   | Notifications     | Notification history |
| `/profile/:id`     | Profile           | User profile         |
| `/settings`        | Settings          | User settings        |
| `/communities`     | Communities       | Community list       |
| `/communities/:id` | Community         | Single community     |
| `/forum`           | Forum             | Forum discussions    |

## Component Structure

```
apps/client-interface/src/app/
├── components/
│   ├── common/          # Shared components
│   ├── toolbar/         # Navigation toolbar
│   ├── notifications/   # Notification components
│   ├── social/          # Social feed components
│   └── ...
├── services/            # Application services
├── directives/          # Custom directives
├── guards/              # Route guards
└── state/               # State management
```

## Design System

The application uses a custom design system built with:

- **CSS Custom Properties** for theming
- **Component Library** for consistent UI
- **Theme Service** for runtime theme switching
- **Responsive Design** for mobile and desktop

### Available UI Components

From `@optimistic-tanuki/common-ui`:

- Button (primary, secondary, outlined, text)
- Card
- Modal
- Dropdown
- Tabs
- Badge
- Spinner
- Accordion
- List
- Table
- Pagination
- And more...

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+
- Angular CLI 17+

### Development Server

```bash
# Start development server
pnpm start

# Or with nx
pnpm exec nx serve client-interface
```

### Build

```bash
# Production build
pnpm run build

# Or with nx
pnpm exec nx build client-interface
```

## Related Documentation

- [Authentication & User Management](./features/authentication.md)
- [News Feed & Content](./features/feed.md)
- [Notifications](./features/notifications.md)
- [Search & Discovery](./features/search.md)
- [Messaging & Chat](./features/messaging.md)
- [Privacy & Safety](./features/privacy.md)
- [Profile & Analytics](./features/profile.md)
- [Communities](./features/communities.md)
- [Accessibility & Error Handling](./features/accessibility.md)
