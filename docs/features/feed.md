# News Feed & Content

The news feed is the central hub for content consumption and sharing. It provides a personalized experience based on user connections and interests.

## Features

### Feed Types

- **Public Feed**: Posts from all users
- **Following Feed**: Posts from followed users
- **Community Feed**: Posts from joined communities

### Post Creation

Users can create various types of posts:

- Text posts
- Image posts with attachments
- Poll posts
- Shared posts

### Interactions

- **Like**: Show appreciation for posts
- **Comment**: Join the conversation
- **Share**: Repost to your followers
- **Save**: Bookmark posts for later

### Infinite Scroll

The feed uses infinite scroll for seamless browsing:

- Automatically loads more content
- Loading indicators
- "End of feed" message when no more content

## Components

| Component           | Description             |
| ------------------- | ----------------------- |
| FeedComponent       | Main feed display       |
| PostComponent       | Individual post display |
| PostCreateComponent | Create new posts        |
| CommentsComponent   | Post comments           |

## Services

| Service         | Description          |
| --------------- | -------------------- |
| PostService     | Post CRUD operations |
| VoteService     | Like/unlike posts    |
| CommentService  | Comment management   |
| ActivityService | Activity tracking    |

## Content Types

### Standard Posts

Regular text and image posts visible to followers.

### Polls

Interactive polls with multiple choice options and vote tracking.

### Events

Posts promoting events with date, time, and RSVP functionality.

### Scheduled Posts

Posts scheduled for future publication.

### Shared Posts

Reposts of existing posts with optional commentary.

## Performance

The feed is optimized for performance:

- Infinite scroll with intersection observers
- Lazy loading for images
- Pagination support
- Efficient state management with Angular Signals
