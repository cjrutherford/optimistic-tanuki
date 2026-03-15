# OAuth Provider Setup Guide

This guide explains how to configure OAuth authentication providers for the Optimistic Tanuki platform.

## Overview

The authentication service supports the following OAuth providers:

- **Google**
- **GitHub**
- **Microsoft**
- **Facebook**
- **Twitter (X)**

Each provider requires its own set of credentials (Client ID and Client Secret) which must be obtained from the respective developer consoles.

## Configuration Methods

### Method 1: Environment Variables (Recommended for Docker)

The authentication service uses environment variable substitution in the `config.yaml` file. When running via Docker Compose, you can pass these values as environment variables:

```yaml
# docker-compose.yml
services:
  authentication:
    environment:
      # Google OAuth
      - GOOGLE_CLIENT_ID=your-google-client-id
      - GOOGLE_CLIENT_SECRET=your-google-client-secret
      - GOOGLE_REDIRECT_URI=https://your-domain.com/oauth/callback

      # GitHub OAuth
      - GITHUB_CLIENT_ID=your-github-client-id
      - GITHUB_CLIENT_SECRET=your-github-client-secret
      - GITHUB_REDIRECT_URI=https://your-domain.com/oauth/callback

      # Microsoft OAuth
      - MICROSOFT_CLIENT_ID=your-microsoft-client-id
      - MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
      - MICROSOFT_REDIRECT_URI=https://your-domain.com/oauth/callback

      # Facebook OAuth
      - FACEBOOK_CLIENT_ID=your-facebook-app-id
      - FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
      - FACEBOOK_REDIRECT_URI=https://your-domain.com/oauth/callback

      # Twitter/X OAuth
      - X_CLIENT_ID=your-twitter-client-id
      - X_CLIENT_SECRET=your-twitter-client-secret
      - X_REDIRECT_URI=https://your-domain.com/oauth/callback
```

### Method 2: Direct Configuration (Development)

For local development, you can directly edit the `apps/authentication/src/assets/config.yaml` file:

```yaml
oauth:
  google:
    enabled: true
    clientId: 'your-actual-client-id'
    clientSecret: 'your-actual-client-secret'
    redirectUri: 'http://localhost:4200/oauth/callback'
```

**Note:** Never commit actual credentials to version control. Use environment variables for production deployments.

## Provider-Specific Setup Instructions

### Google OAuth 2.0

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Add authorized redirect URIs:
   - `https://your-domain.com/oauth/callback`
   - `http://localhost:4200/oauth/callback` (for local development)
7. Copy the Client ID and Client Secret

**Required Scopes:**

- `openid`
- `email`
- `profile`

### GitHub OAuth

1. Go to your [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App" or "Register a new application"
3. Fill in the application details:
   - Application name: Your app name
   - Homepage URL: `https://your-domain.com`
   - Authorization callback URL: `https://your-domain.com/oauth/callback`
4. Copy the Client ID
5. Generate a new Client Secret and copy it

**Required Scopes:**

- `read:user`
- `user:email`

### Microsoft Identity Platform

1. Go to the [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Enter a name and select supported account types (typically "Accounts in any organizational directory and personal Microsoft accounts")
5. Set the redirect URI:
   - Platform: Web
   - URI: `https://your-domain.com/oauth/callback`
6. Copy the Application (client) ID
7. Go to "Certificates & secrets" and create a new client secret

**Required Scopes:**

- `openid`
- `email`
- `profile`
- `User.Read`

### Facebook Login

1. Go to the [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select an existing one
3. Add the "Facebook Login" product to your app
4. In Settings > Basic, copy the App ID and App Secret
5. Configure the Valid OAuth Redirect URIs:
   - `https://your-domain.com/oauth/callback`

**Required Scopes:**

- `email`
- `public_profile`

### Twitter/X OAuth 2.0

1. Go to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app
3. In the app settings, enable "OAuth 2.0"
4. Set the callback URL:
   - `https://your-domain.com/oauth/callback`
5. Copy the Client ID and Client Secret

**Required Scopes:**

- `tweet.read`
- `users.read`

**Note:** Twitter/X requires PKCE (Proof Key for Code Exchange) which is automatically handled by the authentication service.

## Redirect URI Configuration

The redirect URI must match exactly between:

1. Your OAuth provider's app configuration
2. The `redirectUri` value in your configuration

**Common patterns:**

- Production: `https://your-domain.com/oauth/callback`
- Local development: `http://localhost:4200/oauth/callback`

## Security Best Practices

1. **Use HTTPS in production**: Never use HTTP redirect URIs in production environments
2. **Protect your secrets**: Store Client Secrets securely (e.g., using Docker secrets, Kubernetes secrets, or a secrets manager)
3. **Validate redirect URIs**: Ensure the redirect URI in your OAuth app matches your deployment exactly
4. **Use environment-specific apps**: Create separate OAuth apps for development, staging, and production
5. **Review scopes**: Only request the minimum scopes necessary for your application

## Troubleshooting

### Provider Not Appearing in UI

If a provider button doesn't appear:

1. Check that the provider is `enabled: true` in the configuration
2. Verify that `clientId` is not empty
3. Check the browser console for configuration errors
4. Verify the `/api/oauth/config` endpoint returns the provider configuration

### "OAuth provider is not configured" Error

This error appears when:

- The `clientId` is empty or not set
- The environment variable wasn't passed correctly to the container
- The configuration wasn't reloaded after changes

### Redirect URI Mismatch

If you get a redirect URI mismatch error:

1. Verify the redirect URI in your OAuth provider console matches your config exactly
2. Check for trailing slashes, http vs https, and www vs non-www
3. Ensure the URI is properly URL-encoded if it contains special characters

### Provider Returns Error

Common causes:

- **Invalid credentials**: Double-check Client ID and Secret
- **App not approved**: Some providers require app review before public use
- **Scope issues**: Ensure you've enabled the required APIs/products for your app

## Environment Variable Reference

| Variable                  | Description                | Example                                       |
| ------------------------- | -------------------------- | --------------------------------------------- |
| `GOOGLE_CLIENT_ID`        | Google OAuth Client ID     | `123456789-abc123.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`    | Google OAuth Client Secret | `GOCSPX-xxxxxxxx`                             |
| `GOOGLE_REDIRECT_URI`     | Google Redirect URI        | `https://app.example.com/oauth/callback`      |
| `GITHUB_CLIENT_ID`        | GitHub OAuth App Client ID | `Iv1.abc123`                                  |
| `GITHUB_CLIENT_SECRET`    | GitHub OAuth App Secret    | `abc123def456`                                |
| `GITHUB_REDIRECT_URI`     | GitHub Redirect URI        | `https://app.example.com/oauth/callback`      |
| `MICROSOFT_CLIENT_ID`     | Microsoft App Client ID    | `12345678-1234-1234-1234-123456789012`        |
| `MICROSOFT_CLIENT_SECRET` | Microsoft App Secret       | `abc123~def456`                               |
| `MICROSOFT_REDIRECT_URI`  | Microsoft Redirect URI     | `https://app.example.com/oauth/callback`      |
| `FACEBOOK_CLIENT_ID`      | Facebook App ID            | `1234567890123456`                            |
| `FACEBOOK_CLIENT_SECRET`  | Facebook App Secret        | `abc123def456ghi789`                          |
| `FACEBOOK_REDIRECT_URI`   | Facebook Redirect URI      | `https://app.example.com/oauth/callback`      |
| `X_CLIENT_ID`             | Twitter/X Client ID        | `abc123def456`                                |
| `X_CLIENT_SECRET`         | Twitter/X Client Secret    | `xyz789uvw456`                                |
| `X_REDIRECT_URI`          | Twitter/X Redirect URI     | `https://app.example.com/oauth/callback`      |

## Support

For issues specific to OAuth provider configuration, refer to the official documentation:

- [Google Identity Platform](https://developers.google.com/identity)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login/)
- [Twitter/X OAuth 2.0](https://developer.twitter.com/en/docs/authentication/oauth-2-0)

## Step-by-Step Provider Setup

### Google OAuth 2.0 Setup

**Step 1: Create a Google Cloud Project**
1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Select "New Project"
4. Enter a project name (e.g., "Optimistic Tanuki")
5. Click "Create"

**Step 2: Enable the Google+ API**
1. In the left sidebar, go to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click on it and select "Enable"

**Step 3: Create OAuth Credentials**
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, click "Configure OAuth consent screen"
4. Select "External" for User Type and click "Create"
5. Fill in the consent screen:
   - App name: "Optimistic Tanuki"
   - User support email: your email
   - Developer contact: your email
6. Click "Save and Continue"
7. On the Scopes page, click "Add or Remove Scopes"
8. Add: `openid`, `email`, `profile`
9. Click "Update" and continue through remaining steps
10. Return to Credentials and click "Create Credentials" > "OAuth client ID"
11. Select "Web application"
12. Under "Authorized redirect URIs", add:
    - `http://localhost:4200/oauth/callback`
    - `https://your-domain.com/oauth/callback`
13. Click "Create"
14. Copy the Client ID and Client Secret

**Step 4: Configure in Optimistic Tanuki**
```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GOOGLE_REDIRECT_URI="https://your-domain.com/oauth/callback"
```

### GitHub OAuth Setup

**Step 1: Access Developer Settings**
1. Go to [GitHub Settings > Developer Settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"

**Step 2: Register Application**
Fill in the form:
- **Application name:** `Optimistic Tanuki`
- **Homepage URL:** `https://your-domain.com`
- **Application description:** `OAuth authentication for Optimistic Tanuki platform`
- **Authorization callback URL:** `https://your-domain.com/oauth/callback`

Click "Register application"

**Step 3: Generate Client Secret**
1. You'll see your Client ID on the app page
2. Click "Generate a new client secret"
3. Copy both the Client ID and Client Secret immediately (you won't see the secret again)

**Step 4: Configure in Optimistic Tanuki**
```bash
export GITHUB_CLIENT_ID="your-client-id"
export GITHUB_CLIENT_SECRET="your-client-secret"
export GITHUB_REDIRECT_URI="https://your-domain.com/oauth/callback"
```

### Microsoft Identity Platform Setup

**Step 1: Register Application**
1. Go to [Azure Portal](https://portal.azure.com/)
2. Search for "App registrations" in the top search bar
3. Click "New registration"

**Step 2: Configure Registration**
- **Name:** `Optimistic Tanuki`
- **Supported account types:** Select "Accounts in any organizational directory and personal Microsoft accounts"
- **Redirect URI:** Select "Web" and enter `https://your-domain.com/oauth/callback`
- Click "Register"

**Step 3: Add Authentication**
1. In the left menu, go to "Authentication"
2. Under "Platform configurations", click "Add a platform"
3. Select "Web"
4. Add redirect URIs:
   - `http://localhost:4200/oauth/callback`
   - `https://your-domain.com/oauth/callback`
5. Under "Implicit grant and hybrid flows", check both boxes
6. Click "Configure"

**Step 4: Create Client Secret**
1. Go to "Certificates & secrets" in the left menu
2. Click "New client secret"
3. Enter description: `OAuth application`
4. Set expiration to your preference
5. Click "Add"
6. Copy the secret Value immediately

**Step 5: Get Application ID**
1. Go to "Overview" in the left menu
2. Copy the "Application (client) ID"

**Step 6: Configure in Optimistic Tanuki**
```bash
export MICROSOFT_CLIENT_ID="your-application-id"
export MICROSOFT_CLIENT_SECRET="your-client-secret"
export MICROSOFT_REDIRECT_URI="https://your-domain.com/oauth/callback"
```

### Facebook Login Setup

**Step 1: Create or Select App**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" dropdown
3. Click "Create App" or select existing app

**Step 2: Add Facebook Login Product**
1. On the app dashboard, click "Add Product"
2. Find "Facebook Login" and click "Set Up"
3. Select "Web" as your platform

**Step 3: Configure OAuth Redirect URIs**
1. In the left menu, go to "Settings" > "Basic"
2. Note your App ID and App Secret (copy both)
3. Go to "Products" > "Facebook Login" > "Settings"
4. Under "Valid OAuth Redirect URIs", add:
   - `http://localhost:4200/oauth/callback`
   - `https://your-domain.com/oauth/callback`
5. Save changes

**Step 4: Configure in Optimistic Tanuki**
```bash
export FACEBOOK_CLIENT_ID="your-app-id"
export FACEBOOK_CLIENT_SECRET="your-app-secret"
export FACEBOOK_REDIRECT_URI="https://your-domain.com/oauth/callback"
```
