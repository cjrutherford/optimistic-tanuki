# Privacy & Safety

The platform provides comprehensive privacy controls and safety features to protect users.

## Features

### User Blocking

- Block specific users
- Blocked users cannot see your content
- Blocked users cannot contact you

### User Muting

- Mute specific users
- See their content less frequently
- Still visible if you visit their profile

### Content Reporting

Report inappropriate content:

- Spam
- Harassment
- Inappropriate content
- Misinformation

Reports are reviewed by moderators.

### Privacy Settings

Users can control:

- Profile visibility
- Who can see posts
- Who can send messages
- Who can follow

## Components

| Component                | Description           |
| ------------------------ | --------------------- |
| PrivacySettingsComponent | Privacy settings page |
| ReportDialogComponent    | Report content dialog |

## Services

| Service        | Description                    |
| -------------- | ------------------------------ |
| PrivacyService | Block, mute, report operations |

## API Endpoints

### Block

| Method | Endpoint                  | Description       |
| ------ | ------------------------- | ----------------- |
| GET    | `/api/privacy/blocks`     | Get blocked users |
| POST   | `/api/privacy/blocks`     | Block a user      |
| DELETE | `/api/privacy/blocks/:id` | Unblock a user    |

### Mute

| Method | Endpoint                 | Description     |
| ------ | ------------------------ | --------------- |
| GET    | `/api/privacy/mutes`     | Get muted users |
| POST   | `/api/privacy/mutes`     | Mute a user     |
| DELETE | `/api/privacy/mutes/:id` | Unmute a user   |

### Reports

| Method | Endpoint                   | Description        |
| ------ | -------------------------- | ------------------ |
| GET    | `/api/privacy/reports`     | Get user's reports |
| POST   | `/api/privacy/reports`     | Submit a report    |
| DELETE | `/api/privacy/reports/:id` | Withdraw report    |

## Safety Features

1. **Content Moderation**: Automated and manual content review
2. **User Verification**: Verified badges for authentic accounts
3. **Block Lists**: Manage blocked/muted users
4. **Privacy Controls**: Fine-grained visibility settings
