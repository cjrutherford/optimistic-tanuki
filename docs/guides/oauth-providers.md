# OAuth Provider Setup Guide

This guide covers how to configure OAuth and social login providers in Optimistic Tanuki. The platform supports Google, GitHub, Microsoft, and Facebook, along with any custom OAuth-compatible provider.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Provider Setup](#provider-setup)
  - [Google](#google)
  - [GitHub](#github)
  - [Microsoft](#microsoft)
  - [Facebook](#facebook)
  - [Custom Provider](#custom-provider)
- [Gateway API Endpoints](#gateway-api-endpoints)
- [UI Integration](#ui-integration)
  - [OAuthButtonsComponent](#oauthbuttonscomponent)
  - [LoginBlockComponent](#loginblockcomponent)
  - [Handling Provider Events](#handling-provider-events)
- [Account Linking and Unlinking](#account-linking-and-unlinking)
- [Authentication Flow](#authentication-flow)
- [Database Schema](#database-schema)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

OAuth integration spans three layers:

| Layer | Component | Purpose |
|---|---|---|
| **Backend** | `OAuthService` (authentication microservice) | Handles provider login, account linking/unlinking, JWT issuance |
| **Gateway** | `OAuthController` | Exposes REST API endpoints, routes requests to the authentication microservice via TCP |
| **Frontend** | `OAuthButtonsComponent` (auth-ui library) | Renders provider login buttons in all UI applications |

```
  UI Application
    └── OAuthButtonsComponent
          │
          ▼  HTTP
  Gateway (port 3000)
    └── OAuthController
          │
          ▼  TCP (port 3001)
  Authentication Microservice
    └── OAuthService
          └── OAuthProviderEntity (database)
```

### Supported Providers

The `OAuthProvider` enum defines all supported providers:

```typescript
enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  MICROSOFT = 'microsoft',
  FACEBOOK = 'facebook',
  CUSTOM = 'custom',
}
```

---

## Quick Start

1. **Register your application** with the OAuth provider (e.g., Google Cloud Console).
2. **Get your client ID and client secret** from the provider.
3. **Set the callback URL** in the provider's configuration to point at your frontend application.
4. **Implement the client-side OAuth flow** — exchange the authorization code for user info.
5. **Send the provider callback** to `POST /api/oauth/callback` with the user info.

The gateway expects the client to handle the provider-specific OAuth dance (redirect → authorization → token exchange) and send the resulting user information to the callback endpoint. This keeps the gateway stateless and decoupled from individual provider SDKs.

---

## Provider Setup

Each provider requires you to register an application in their developer console to get a **Client ID** and **Client Secret**. Below are step-by-step instructions for each provider.

### Google

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services → Credentials**.
4. Click **Create Credentials → OAuth client ID**.
5. Select **Web application** as the application type.
6. Add your authorized redirect URIs:
   - Development: `http://localhost:4200/auth/callback/google`
   - Production: `https://yourdomain.com/auth/callback/google`
7. Note the **Client ID** and **Client Secret**.

**Required scopes:**
- `openid`
- `email`
- `profile`

**Environment variables:**

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4200/auth/callback/google
```

**Token exchange endpoint:** `https://oauth2.googleapis.com/token`
**User info endpoint:** `https://www.googleapis.com/oauth2/v3/userinfo`

### GitHub

1. Go to [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Fill in the application details:
   - **Application name:** Your app name
   - **Homepage URL:** `http://localhost:4200` (or your production URL)
   - **Authorization callback URL:** `http://localhost:4200/auth/callback/github`
4. Click **Register application**.
5. Note the **Client ID** and generate a **Client Secret**.

**Required scopes:**
- `read:user`
- `user:email`

**Environment variables:**

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:4200/auth/callback/github
```

**Token exchange endpoint:** `https://github.com/login/oauth/access_token`
**User info endpoint:** `https://api.github.com/user`

### Microsoft

1. Go to the [Azure Portal → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).
2. Click **New registration**.
3. Fill in the details:
   - **Name:** Your app name
   - **Supported account types:** Select based on your audience (personal, work, or both)
   - **Redirect URI:** `http://localhost:4200/auth/callback/microsoft` (type: **SPA** or **Web**)
4. Note the **Application (client) ID**.
5. Under **Certificates & secrets**, create a new client secret and note the value.

**Required scopes:**
- `openid`
- `email`
- `profile`
- `User.Read`

**Environment variables:**

```bash
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT_ID=common
MICROSOFT_CALLBACK_URL=http://localhost:4200/auth/callback/microsoft
```

**Token exchange endpoint:** `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
**User info endpoint:** `https://graph.microsoft.com/v1.0/me`

### Facebook

1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Create a new app (select **Consumer** type).
3. Navigate to **Facebook Login → Settings**.
4. Add your redirect URIs under **Valid OAuth Redirect URIs**:
   - Development: `http://localhost:4200/auth/callback/facebook`
   - Production: `https://yourdomain.com/auth/callback/facebook`
5. Note the **App ID** and **App Secret** from **Settings → Basic**.

**Required permissions:**
- `email`
- `public_profile`

**Environment variables:**

```bash
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:4200/auth/callback/facebook
```

**Token exchange endpoint:** `https://graph.facebook.com/v18.0/oauth/access_token`
**User info endpoint:** `https://graph.facebook.com/v18.0/me?fields=id,name,email`

### Custom Provider

Any OAuth 2.0-compatible provider can be used with the `CUSTOM` provider type. Your frontend handles the OAuth flow, and the callback payload includes the provider information:

```typescript
// POST /api/oauth/callback
{
  "provider": "custom",
  "code": "authorization-code",
  "state": "csrf-state-token",
  "redirectUri": "http://localhost:4200/auth/callback/custom"
}
```

---

## Gateway API Endpoints

The gateway exposes these OAuth endpoints under `/api/oauth`:

### POST `/api/oauth/callback` (Public)

Handles the OAuth provider callback. If the user exists and is linked, returns a JWT. If not, returns registration information.

**Request body** (`OAuthCallbackRequest`):

```json
{
  "provider": "google",
  "code": "authorization-code-from-provider",
  "state": "csrf-state-token",
  "redirectUri": "http://localhost:4200/auth/callback/google"
}
```

**Success response** (existing user):

```json
{
  "message": "OAuth login successful",
  "code": 0,
  "data": { "newToken": "jwt-token-here" }
}
```

**Response** (new user, needs registration):

```json
{
  "message": "No linked account found",
  "code": 1,
  "data": {
    "provider": "google",
    "providerUserId": "12345",
    "email": "user@gmail.com",
    "displayName": "User Name",
    "needsRegistration": true
  }
}
```

### POST `/api/oauth/link` (Authenticated)

Links an OAuth provider to the current user's account.

**Request body** (`LinkProviderRequest`, `userId` is injected from JWT):

```json
{
  "provider": "github",
  "providerUserId": "gh-12345",
  "accessToken": "provider-access-token",
  "refreshToken": "provider-refresh-token",
  "providerEmail": "user@github.com",
  "providerDisplayName": "username"
}
```

**Response:**

```json
{
  "message": "Provider github linked successfully",
  "code": 0,
  "data": {
    "id": "uuid",
    "provider": "github",
    "providerEmail": "user@github.com",
    "providerDisplayName": "username"
  }
}
```

### POST `/api/oauth/unlink` (Authenticated)

Removes a linked OAuth provider from the current user's account.

> **Safety check:** You cannot unlink the last authentication provider if no password is set.

**Request body** (`UnlinkProviderRequest`, `userId` is injected from JWT):

```json
{
  "provider": "github"
}
```

**Response:**

```json
{
  "message": "Provider github unlinked successfully",
  "code": 0
}
```

### GET `/api/oauth/providers` (Authenticated)

Returns all OAuth providers linked to the current user.

**Response:**

```json
{
  "message": "Linked providers retrieved",
  "code": 0,
  "data": [
    {
      "id": "uuid",
      "provider": "google",
      "providerEmail": "user@gmail.com",
      "providerDisplayName": "User Name",
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ]
}
```

---

## UI Integration

The `@optimistic-tanuki/auth-ui` library provides ready-to-use OAuth components for all frontend applications.

### OAuthButtonsComponent

Renders a row of provider login buttons. Drop it into any component:

```html
<lib-oauth-buttons
  [enabledProviders]="['google', 'github', 'microsoft']"
  [showDivider]="true"
  (providerSelected)="onOAuthProvider($event)">
</lib-oauth-buttons>
```

**Inputs:**

| Input | Type | Default | Description |
|---|---|---|---|
| `enabledProviders` | `string[]` | `['google', 'github', 'microsoft', 'facebook', 'x']` | Which provider buttons to show |
| `showDivider` | `boolean` | `true` | Show "or sign in with" divider |

**Output:**

| Output | Type | Description |
|---|---|---|
| `providerSelected` | `EventEmitter<OAuthProviderEvent>` | Emits `{ provider: 'google' }` when a button is clicked |

### LoginBlockComponent

The login form component has built-in OAuth support:

```html
<lib-login-block
  [showOAuth]="true"
  [enabledOAuthProviders]="['google', 'github']"
  (oauthProviderSelected)="handleOAuth($event)"
  (loginSubmit)="handleLogin($event)">
</lib-login-block>
```

**OAuth-related inputs:**

| Input | Type | Default | Description |
|---|---|---|---|
| `showOAuth` | `boolean` | `false` | Show OAuth buttons below the login form |
| `enabledOAuthProviders` | `string[]` | `['google', 'github', 'microsoft', 'facebook']` | Which providers to enable |

**OAuth-related output:**

| Output | Type | Description |
|---|---|---|
| `oauthProviderSelected` | `EventEmitter<OAuthProviderEvent>` | Emits when a provider button is clicked |

### Handling Provider Events

In your login component, handle the provider selection and initiate the OAuth flow:

```typescript
import { OAuthProviderEvent } from '@optimistic-tanuki/auth-ui';

@Component({ /* ... */ })
export class LoginComponent {
  handleOAuth(event: OAuthProviderEvent) {
    // Redirect to the provider's authorization URL
    const authUrls: Record<string, string> = {
      google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_CALLBACK_URL}&response_type=code&scope=openid email profile`,
      github: `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_CALLBACK_URL}&scope=read:user user:email`,
      microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${MICROSOFT_CLIENT_ID}&redirect_uri=${MICROSOFT_CALLBACK_URL}&response_type=code&scope=openid email profile User.Read`,
      facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${FACEBOOK_CALLBACK_URL}&scope=email,public_profile`,
    };

    const url = authUrls[event.provider];
    if (url) {
      window.location.href = url;
    }
  }
}
```

---

## Account Linking and Unlinking

Authenticated users can link multiple OAuth providers to their account and unlink them later.

### Linking a Provider

After the user authenticates with a provider, send the provider info to the link endpoint:

```typescript
// POST /api/oauth/link
this.http.post('/api/oauth/link', {
  provider: 'github',
  providerUserId: githubUser.id,
  accessToken: oauthTokens.access_token,
  refreshToken: oauthTokens.refresh_token,
  providerEmail: githubUser.email,
  providerDisplayName: githubUser.login,
}).subscribe(result => {
  console.log('Provider linked:', result);
});
```

### Unlinking a Provider

```typescript
// POST /api/oauth/unlink
this.http.post('/api/oauth/unlink', {
  provider: 'github',
}).subscribe(result => {
  console.log('Provider unlinked:', result);
});
```

> **Important:** The system prevents unlinking the last authentication method. If a user has no password and only one linked provider, the unlink request will fail with: `"Cannot unlink the last authentication provider. Set a password first."`

### Listing Linked Providers

```typescript
// GET /api/oauth/providers
this.http.get('/api/oauth/providers').subscribe(result => {
  // result.data = [{ provider: 'google', providerEmail: '...', ... }]
});
```

---

## Authentication Flow

### New User (Registration Required)

```
1. User clicks "Sign in with Google" in the UI
2. Frontend redirects to Google's authorization page
3. User authorizes the application
4. Google redirects back with an authorization code
5. Frontend exchanges the code for tokens + user info (client-side)
6. Frontend sends POST /api/oauth/callback with provider info
7. Backend looks up the provider — no linked account found
8. Backend returns { needsRegistration: true, email, displayName, ... }
9. Frontend shows registration form pre-filled with provider info
10. User completes registration → account is created and provider is auto-linked
```

### Existing User (Login)

```
1. User clicks "Sign in with GitHub" in the UI
2. Frontend redirects to GitHub's authorization page
3. User authorizes the application
4. GitHub redirects back with an authorization code
5. Frontend exchanges the code for tokens + user info (client-side)
6. Frontend sends POST /api/oauth/callback with provider info
7. Backend finds linked account → issues JWT
8. Frontend stores JWT and navigates to the app
```

### Auto-Linking by Email

If a user exists with the same email as the OAuth provider profile but has not linked that provider yet, the system automatically links the provider to the existing account on first OAuth login.

---

## Database Schema

The `oauth_provider` table stores linked OAuth accounts:

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique record identifier |
| `provider` | VARCHAR | Provider name (`google`, `github`, etc.) |
| `providerUserId` | VARCHAR | User ID from the provider |
| `providerEmail` | VARCHAR (nullable) | Email from the provider profile |
| `providerDisplayName` | VARCHAR (nullable) | Display name from the provider |
| `accessToken` | TEXT (nullable) | Provider access token |
| `refreshToken` | TEXT (nullable) | Provider refresh token |
| `userId` | UUID (FK) | Links to the `user` table |
| `createdAt` | TIMESTAMP | Record creation time |
| `updatedAt` | TIMESTAMP | Last update time |

A user can have multiple rows (one per provider). Each provider can only be linked to one user account.

---

## Security Considerations

### Token Storage

OAuth access and refresh tokens are stored in the database. For production deployments:

- **Encrypt tokens at rest** using application-level encryption before persisting.
- **Rotate tokens** when the provider supports it (e.g., refresh token rotation).
- **Limit token scopes** to the minimum required permissions.

### CSRF Protection

- Always use the `state` parameter in OAuth authorization requests.
- Generate a random value, store it in the user's session, and verify it in the callback.

### Redirect URI Validation

- Register all valid redirect URIs with the provider.
- Never allow open redirects in your callback handling.

### Provider Account Conflicts

- The system prevents linking one provider account to multiple user accounts.
- Auto-linking by email only occurs if the email address is verified by the provider.

### Unlinking Safety

- Users cannot unlink their last authentication method unless they have a password set.
- This prevents account lockout.

---

## Troubleshooting

### "No linked account found" on login

This means the OAuth provider account is not linked to any user. The response includes `needsRegistration: true` — the frontend should offer to create a new account or link to an existing one.

### "Provider X is already linked to this account"

The user tried to link a provider that is already connected. Use `GET /api/oauth/providers` to see linked providers.

### "This X account is already linked to another user"

A different user already linked this specific provider account. Each provider account can only be linked to one user.

### "Cannot unlink the last authentication provider"

The user has no password set and this is their only linked provider. They must set a password first before unlinking.

### OAuth callback fails with 500

- Check the gateway logs for `Error in oauthCallback`.
- Verify the authentication microservice is running on port 3001.
- Ensure the `OAuthProviderEntity` is included in the database configuration.

### Provider buttons not showing

- Ensure `showOAuth` is `true` on `LoginBlockComponent`.
- Check that `enabledOAuthProviders` includes the desired providers.
- Verify the `OAuthButtonsComponent` is imported in the module.
