# Search & Discovery

The search and discovery features help users find content, users, and communities across the platform.

## Features

### Global Search

Search across all platform content:

- Users
- Posts
- Communities

The search bar is available in the toolbar for quick access.

### Search Filters

| Filter      | Description     |
| ----------- | --------------- |
| All         | All results     |
| Users       | User profiles   |
| Posts       | Post content    |
| Communities | Community pages |

### Explore Page

The Explore page provides:

- Trending posts
- Suggested users to follow
- Popular communities
- Search history

## Components

| Component             | Description                |
| --------------------- | -------------------------- |
| GlobalSearchComponent | Search dropdown in toolbar |
| ExplorePageComponent  | Discovery page             |

## Services

| Service       | Description       |
| ------------- | ----------------- |
| SearchService | Search operations |

## API Endpoints

| Method | Endpoint                  | Description                     |
| ------ | ------------------------- | ------------------------------- |
| GET    | `/api/search`             | Search all content              |
| GET    | `/api/search/trending`    | Get trending content            |
| GET    | `/api/search/suggestions` | Get suggested users/communities |
| GET    | `/api/search/history`     | Get search history              |
| DELETE | `/api/search/history`     | Clear search history            |

## User Discovery

The platform helps users discover new content through:

- Suggested users based on connections
- Trending posts
- Popular communities
- Content recommendations
