# Changelog

## v1.2.0 - 2026-09-25

### Features

- **Token-based email community invites** - Users can invite others via email with secure token-based invites that include expiration and status tracking
- **Community invite management** - Accept/decline invites via email tokens, preview invites, and claim them into communities
- **Profile enhancements** - Added profile pages and account/profile sections for viewing seller profiles
- **SSR helpers** - Added utility functions for `getSsrAllowedHosts()`, `isTrustProxyEnabled()`, `getSsrEngineOptions()`, `parseAllowedHostsList()`, and `hostnameFromBaseUrl()`
- **Media 502 diagnostic** - Improved error handling for media endpoints with `media-unconfigured` error code
- **Double-upload/spinner fixes** - Fixed spinner logic in community UI components
- **Community creation** - Enhanced community creation flow with upload tracking and error handling
- **Contract parity** - Updated social contract parity specifications

### Technical

- **TypeORM migration** - Added `community_invite` table with `inviteeEmail`, `token`, `expiresAt` columns
- **Service layer** - Implemented `CommunityService` methods for inviting, accepting, and managing invites
- **Gateway endpoints** - Added invite endpoints with email resolution and token-based acceptance
- **Mailer** - Created `CommunityInviteMailer` for sending courtesy emails
- **Models** - Updated `CommunityInvite` entity and related DTOs

## Previous Changes

- Various fixes and improvements across the codebase
