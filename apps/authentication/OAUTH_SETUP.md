# OAuth Setup

The canonical operator documentation is [OAuth and Email Verification Setup](../../docs/guides/authentication-setup.md).

Use the server-owned flow described there:

- start login through `GET /api/oauth/start/:provider`
- register each provider redirect as `https://<client-interface>/oauth/callback/:provider`
- configure gateway-scoped provider credentials and `OAUTH_STATE_SECRET`
- use `GET /api/oauth/link/:provider` for authenticated account linking

Do not implement a browser token exchange and do not call the retired direct callback endpoints. The provider callback page forwards the authorization response to the gateway, which validates state and exchanges it server-side.
