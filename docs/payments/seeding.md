# Payments Provider Setup

This guide documents how the payments microservice is configured today, how to set up each supported provider, and how to support deployments where different apps use different providers or a single app uses more than one provider by flow.

## Current Model

The payments service has two layers of provider selection:

1. `paymentProvider`: the default provider for any flow that does not declare its own override.
2. `paymentFlows`: flow-level routing for `donations`, `classifieds`, `business`, and `sponsorship`.

That means a single app can already use more than one provider at the same time. The current `local-hub` setup is:

- `donations` → `helcim`
- `classifieds` → `stripe-connect`
- `business` → `helcim`
- `sponsorship` → `helcim`

There is one important runtime constraint to be explicit about:

- `paymentFlows` is deployment-wide for a single payments config file.
- Stripe Connect credentials are app-scoped in `stripeConnect.apps[appScope]`.
- Lemon Squeezy credentials are app-scoped in `lemonSqueezy.stores[appScope]`.
- Helcim credentials are currently global to the payments deployment.

If you need two apps to have different flow-routing matrices, run the payments service with different config files per deployment by setting `PAYMENTS_CONFIG_PATH` or `CONFIG_PATH`.

## Provider Capabilities

| Provider         | Current Usage                                                                                          | Config Scope                                                | Notes                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `helcim`         | Donations, billing metadata, card refunds, and currently-configured business/sponsorship flows         | Deployment-wide                                             | Business and sponsorship are provider-routed to Helcim in config, but the actual checkout code still uses the legacy hosted path until that migration is finished. |
| `stripe-connect` | Classified marketplace checkout, seller onboarding, transfer-based release, and transfer-aware refunds | Per app via `stripeConnect.apps`                            | Intended for marketplace flows where sellers receive payouts through connected accounts.                                                                           |
| `lemon-squeezy`  | Legacy hosted subscription/product flows and customer portal links                                     | Per app via `lemonSqueezy.stores` plus default env fallback | Retained for legacy business/sponsorship hosted checkout and product seeding paths.                                                                                |

## Config Resolution Rules

The payments service loads config from `apps/payments/src/assets/config.yaml` unless you point it to another file with:

- `PAYMENTS_CONFIG_PATH`
- `CONFIG_PATH`

This is the supported way to give different app deployments different provider mixes.

Resolution order today:

- YAML file provides the baseline.
- `PAYMENTS_PROVIDER` can override the default provider.
- `PAYMENTS_PROVIDER_DONATIONS`, `PAYMENTS_PROVIDER_CLASSIFIEDS`, `PAYMENTS_PROVIDER_BUSINESS`, and `PAYMENTS_PROVIDER_SPONSORSHIP` can override individual flow routing.
- Helcim env vars override Helcim YAML values.
- Lemon Squeezy env vars override only the default Lemon Squeezy store.
- Stripe Connect is expected to come from YAML, including per-app keys and return URLs.

## Example Mixed-Provider Config

```yaml
listenPort: 3018
paymentProvider: 'helcim'

paymentFlows:
  donations: 'helcim'
  classifieds: 'stripe-connect'
  business: 'helcim'
  sponsorship: 'helcim'

helcim:
  apiToken: ${HELCIM_API_TOKEN:-''}
  baseUrl: ${HELCIM_BASE_URL:-https://api.helcim.com}
  webhookSecret: ${HELCIM_WEBHOOK_SECRET:-''}

stripeConnect:
  default:
    secretKey: ''
    publishableKey: ''
    webhookSecret: ''
    connectReturnUrl: ''
    connectRefreshUrl: ''
  apps:
    local-hub:
      secretKey: ${STRIPE_LOCAL_HUB_SECRET_KEY:-''}
      publishableKey: ${STRIPE_LOCAL_HUB_PUBLISHABLE_KEY:-''}
      webhookSecret: ${STRIPE_LOCAL_HUB_WEBHOOK_SECRET:-''}
      connectReturnUrl: ${LOCAL_HUB_STRIPE_RETURN_URL:-http://localhost:8087/account/payments/stripe/return}
      connectRefreshUrl: ${LOCAL_HUB_STRIPE_REFRESH_URL:-http://localhost:8087/account/payments/stripe/refresh}
    classifieds-admin:
      secretKey: ${STRIPE_CLASSIFIEDS_ADMIN_SECRET_KEY:-''}
      publishableKey: ${STRIPE_CLASSIFIEDS_ADMIN_PUBLISHABLE_KEY:-''}
      webhookSecret: ${STRIPE_CLASSIFIEDS_ADMIN_WEBHOOK_SECRET:-''}
      connectReturnUrl: ${CLASSIFIEDS_ADMIN_STRIPE_RETURN_URL:-https://admin.example.com/account/payments/stripe/return}
      connectRefreshUrl: ${CLASSIFIEDS_ADMIN_STRIPE_REFRESH_URL:-https://admin.example.com/account/payments/stripe/refresh}

lemonSqueezy:
  default:
    apiKey: ${LEMON_SQUEEZY_API_KEY:-''}
    storeId: ${LEMON_SQUEEZY_STORE_ID:-''}
    portalUrl: ${LEMON_SQUEEZY_PORTAL_URL:-''}
  stores:
    local-hub:
      apiKey: ${LEMON_SQUEEZY_LOCAL_HUB_API_KEY:-''}
      storeId: ${LEMON_SQUEEZY_LOCAL_HUB_STORE_ID:-''}
      portalUrl: ${LEMON_SQUEEZY_LOCAL_HUB_PORTAL_URL:-''}
    another-app:
      apiKey: ${LEMON_SQUEEZY_ANOTHER_APP_API_KEY:-''}
      storeId: ${LEMON_SQUEEZY_ANOTHER_APP_STORE_ID:-''}
      portalUrl: ${LEMON_SQUEEZY_ANOTHER_APP_PORTAL_URL:-''}
```

## How To Set Up Each Provider

### Helcim

Use Helcim when the app needs direct card checkout without connected-account marketplace settlement.

Required settings:

| Variable                | Required | Description                                                     |
| ----------------------- | -------- | --------------------------------------------------------------- |
| `HELCIM_API_TOKEN`      | Yes      | API token used for embedded checkout initialization and refunds |
| `HELCIM_BASE_URL`       | No       | Defaults to `https://api.helcim.com`                            |
| `HELCIM_WEBHOOK_SECRET` | Optional | Reserved for future webhook validation                          |

Current active Helcim-backed surface:

- donation embedded checkout initialization and validation
- donation refunds
- billing profile and saved method synchronization from Helcim-backed activity
- classified refunds for Helcim-backed payments

Current limitation:

- Helcim credentials are not app-scoped yet. If two apps need different Helcim merchant accounts, they should run separate payments deployments with different config files.

### Stripe Connect

Use Stripe Connect for marketplace flows where the platform collects buyer funds and later settles to sellers.

Required per app scope in `stripeConnect.apps`:

| Field               | Required | Description                                                                      |
| ------------------- | -------- | -------------------------------------------------------------------------------- |
| `secretKey`         | Yes      | Stripe secret key for server-side PaymentIntent, transfer, and refund operations |
| `publishableKey`    | Yes      | Browser key used by Stripe Elements                                              |
| `webhookSecret`     | Optional | Reserved for webhook validation when webhook handling is added                   |
| `connectReturnUrl`  | Yes      | Seller onboarding return URL                                                     |
| `connectRefreshUrl` | Yes      | Seller onboarding refresh URL                                                    |

Current Stripe Connect surface:

- classifieds buyer checkout via PaymentIntents and Elements
- seller onboarding and seller status refresh
- release of classified funds via Stripe transfers when the seller account is enabled
- classified refunds with Stripe charge refunds and transfer reversals

For Local Hub, the correct onboarding URLs now point to:

- `/account/payments/stripe/return`
- `/account/payments/stripe/refresh`

### Lemon Squeezy

Use Lemon Squeezy only for the legacy hosted subscription/product paths that still exist in the repo.

Default-store env overrides still supported:

| Variable                   | Required | Description                 |
| -------------------------- | -------- | --------------------------- |
| `LEMON_SQUEEZY_API_KEY`    | Optional | Default store API key       |
| `LEMON_SQUEEZY_STORE_ID`   | Optional | Default store id            |
| `LEMON_SQUEEZY_PORTAL_URL` | Optional | Default customer portal URL |

Per-app Lemon Squeezy stores belong in YAML under `lemonSqueezy.stores[appScope]`.

Current Lemon Squeezy surface:

- legacy hosted checkout paths for business pages and sponsorships
- customer portal link generation
- legacy product seeding in `apps/payments/src/seed-products.ts`

## Multi-App Patterns

### One app, multiple providers

This is already supported by `paymentFlows`. Example: one app can use Helcim for donations and Stripe Connect for classifieds.

### Multiple apps, same flow mix, different credentials

This is supported today for:

- Stripe Connect, using `stripeConnect.apps[appScope]`
- Lemon Squeezy, using `lemonSqueezy.stores[appScope]`

### Multiple apps, different flow mixes

This requires separate payments config files and separate deployments, because `paymentFlows` is not currently app-scoped.

Recommended pattern:

1. Copy the baseline payments config for each deployment.
2. Set deployment-specific `paymentFlows`.
3. Point each deployment at its config with `PAYMENTS_CONFIG_PATH`.
4. Keep app-specific Stripe and Lemon Squeezy credentials inside the matching config file.

## Verification Checklist

After changing provider setup, verify the following for each affected app scope:

1. Start the payments service with the intended config file.
2. Confirm `paymentFlows` routes the target flow to the intended provider.
3. Complete a donation if Helcim is active for donations.
4. Complete a classified card payment if Stripe Connect is active for classifieds.
5. For marketplace flows, onboard a seller and confirm `/account/payments/stripe/return` and `/account/payments/stripe/refresh` work.
6. Release a classified payment and confirm the seller receives either a Stripe transfer or the wallet fallback, depending on seller onboarding state.
7. Refund a released classified payment and confirm buyer refund plus seller settlement reversal.

## Files Reference

- `apps/payments/src/assets/config.yaml`
- `apps/payments/src/config.ts`
- `apps/payments/src/app/services/helcim.service.ts`
- `apps/payments/src/app/services/stripe-connect.service.ts`
- `apps/payments/src/app/services/payment.service.ts`
- `apps/gateway/src/controllers/payments/payments.controller.ts`
- `apps/local-hub/src/app/services/payment.service.ts`
- `apps/local-hub/src/app/pages/stripe-connect-return/stripe-connect-return.component.ts`
