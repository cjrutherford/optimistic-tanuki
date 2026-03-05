# Profile & Analytics

Users can view and manage their profiles with detailed analytics on profile views and engagement.

## Features

### Profile Management

- View profile
- Edit profile information
- Upload profile picture
- Update bio and links

### Profile Analytics

- Profile view counts
- View sources (feed, search, direct)
- Follower growth
- Engagement metrics

### Activity History

- View past activities
- See interactions (likes, comments, follows)
- Access saved posts
- Download activity data

## Components

| Component             | Description              |
| --------------------- | ------------------------ |
| ProfileComponent      | Profile view and editing |
| ActivityPageComponent | Activity history         |

## Services

| Service                 | Description        |
| ----------------------- | ------------------ |
| ProfileService          | Profile management |
| ProfileAnalyticsService | Analytics data     |

## API Endpoints

### Profile

| Method | Endpoint                     | Description    |
| ------ | ---------------------------- | -------------- |
| GET    | `/api/profile/:id`           | Get profile    |
| PUT    | `/api/profile/:id`           | Update profile |
| GET    | `/api/profile/:id/followers` | Get followers  |
| GET    | `/api/profile/:id/following` | Get following  |

### Analytics

| Method | Endpoint                                       | Description       |
| ------ | ---------------------------------------------- | ----------------- |
| GET    | `/api/profile-analytics/:profileId`            | Get analytics     |
| GET    | `/api/profile-analytics/:profileId/views`      | Get profile views |
| GET    | `/api/profile-analytics/:profileId/engagement` | Get engagement    |

### Activity

| Method | Endpoint                         | Description          |
| ------ | -------------------------------- | -------------------- |
| GET    | `/api/activity/:profileId`       | Get activity history |
| GET    | `/api/activity/:profileId/saved` | Get saved items      |

## Profile Verification

Users can request verification:

- Submit verification request
- Provide supporting documents
- Review by moderators
- Verified badge upon approval
