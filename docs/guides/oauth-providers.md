---
title: OAuth Provider Reference
summary: Provider console settings for the server-owned Optimistic Tanuki OAuth flow.
category: guides
section: guides
audience: operator
order: 28
tags:
  - oauth
  - authentication
---

# OAuth Provider Reference

Use this page with the full [OAuth and Email Verification Setup Guide](./authentication-setup.md). That guide covers secrets, Docker, Kubernetes, state storage, email verification, and operational testing.

## Important: register the UI callback

OAuth starts at the gateway, but the OAuth provider must redirect to the client-interface callback page:

```text
https://<client-interface>/oauth/callback/<provider>
```

For local Docker development, `<client-interface>` is normally `http://localhost:8080`. For the checked-in production sample, it is `https://optimistic-tanuki.com`.

The callback page forwards the authorization response to the gateway, which validates state and performs token exchange server-side. Do **not** register a gateway URL, build a browser token exchange, or send provider identities to the retired `POST /api/oauth/callback` endpoint.

| Provider  | Redirect URI                | Scopes / permissions                      | Environment variables                                                      |
| --------- | --------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| Google    | `/oauth/callback/google`    | `openid`, `email`, `profile`              | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`          |
| GitHub    | `/oauth/callback/github`    | `read:user`, `user:email`                 | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`          |
| Microsoft | `/oauth/callback/microsoft` | `openid`, `email`, `profile`, `User.Read` | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` |
| Facebook  | `/oauth/callback/facebook`  | `email`, `public_profile`                 | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_REDIRECT_URI`    |

## Google

In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth client of type **Web application**. Add `https://<client-interface>/oauth/callback/google` to Authorized redirect URIs and configure the table's scopes on the consent screen. Copy the client ID and client secret to the gateway environment.

## GitHub

In [GitHub OAuth Apps](https://github.com/settings/developers), create an OAuth App. Set Homepage URL to the public client-interface URL and Authorization callback URL to `https://<client-interface>/oauth/callback/github`. Generate a client secret and configure it with the client ID in the gateway environment.

## Microsoft

In [Microsoft Entra app registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade), create an app registration with the intended account audience. Add a **Web** redirect URI of `https://<client-interface>/oauth/callback/microsoft`, create a client secret, and grant the listed delegated permissions. The checked-in metadata uses the `common` tenant; customize provider metadata only when a tenant-specific flow is required.

## Facebook

In [Meta for Developers](https://developers.facebook.com/), create a Consumer app, enable Facebook Login, and add `https://<client-interface>/oauth/callback/facebook` under Valid OAuth Redirect URIs. Copy the App ID and App Secret to the gateway environment. The app must be live for people outside its test roles to sign in.

## Customizing callback hosts

Set each `*_REDIRECT_URI` explicitly when the provider callback must differ from the `client-interface.uiBaseUrl` in the application registry. Otherwise leave it blank and the gateway derives the callback from that registry URL. Any explicit URI must exactly match the provider console entry, including scheme, port, path, and trailing slash.

After changing provider configuration, deploy the matching credentials and redirect URI together, then run the validation checklist in the [full setup guide](./authentication-setup.md#validation-checklist).
