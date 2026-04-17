# Communities

Communities allow users to gather around shared interests and engage in group discussions.

## Features

### Community Management

- Create new communities
- Set community name, description, and rules
- Upload community banner
- Configure privacy settings (public/private)

### Membership

- Join/leave communities
- Member list
- Admin and moderator roles
- Invite members

### Community Content

- Community posts
- Discussion threads
- Events
- Pinned posts

### Moderation

- Post approval queue
- Remove posts/comments
- Ban members
- Update community settings

## Components

| Component               | Description           |
| ----------------------- | --------------------- |
| CommunitiesComponent    | Community list        |
| CommunityComponent      | Single community view |
| CommunityPostsComponent | Community posts       |

## Services

| Service          | Description    |
| ---------------- | -------------- |
| CommunityService | Community CRUD |

## API Endpoints

| Method | Endpoint                     | Description      |
| ------ | ---------------------------- | ---------------- |
| GET    | `/api/communities`           | List communities |
| POST   | `/api/communities`           | Create community |
| GET    | `/api/communities/:id`       | Get community    |
| PUT    | `/api/communities/:id`       | Update community |
| DELETE | `/api/communities/:id`       | Delete community |
| POST   | `/api/communities/:id/join`  | Join community   |
| POST   | `/api/communities/:id/leave` | Leave community  |

## Community Types

### Public Communities

- Anyone can join
- Posts visible to all
- Appear in search

### Private Communities

- Approval required to join
- Posts visible to members
- Invite-only

### Restricted Communities

- Anyone can request to join
- Posts visible to members
