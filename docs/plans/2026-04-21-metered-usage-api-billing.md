# Metered Usage and Billed Usage API Key System

## Overview

Implement a tiered API usage billing system with volume discounts, per-service pricing, and an "everything included" option. Internal applications receive unmetered access. The system exposes public APIs for external developers to build their own UIs, with OpenAPI documentation served in the dashboard.

## Architecture

### Components

1. **Usage Tracker Service** (`apps/usage-tracker/`)
   - Middleware in gateway to track all API requests
   - Stores usage metrics with service/endpoint granularity
   - Secure aggregated metrics per API key

2. **API Key Management** (`apps/api-key-service/`)
   - CRUD for API keys with plan association
   - Key rotation and revocation
   - Usage quotas and plan enforcement

3. **Billing Plans Service** (`apps/billing/plans/`)
   - Tier management with pricing rules
   - Per-service pricing configuration
   - Bundle ("everything at table") configuration

4. **Developer Dashboard** (`apps/developer-portal/`)
   - API key management UI
   - Usage analytics display
   - OpenAPI spec viewer

### Data Model

```sql
-- API Keys (one per user, free tier keys have user_id linked)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(8), -- First 8 chars for identification
  name VARCHAR(255),
  user_id UUID NOT NULL, -- Required, links to owner
  plan_id UUID REFERENCES billing_plans(id),
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  metadata JSONB
);

-- Usage Records (partitioned by day)
CREATE TABLE usage_records (
  id UUID PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id),
  service_name VARCHAR(100),
  endpoint VARCHAR(255),
  requests_count BIGINT DEFAULT 1,
  recorded_at DATE NOT NULL,
  INDEX (api_key_id, recorded_at)
);

-- Billing Plans
CREATE TABLE billing_plans (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  tier_level INTEGER,
  monthly_requests_limit BIGINT,
  price_cents INTEGER,
  is_unlimited BOOLEAN DEFAULT FALSE,
  is_all_inclusive BOOLEAN DEFAULT FALSE
);

-- Per-Service Pricing
CREATE TABLE service_pricing (
  id UUID PRIMARY KEY,
  service_name VARCHAR(100) UNIQUE,
  price_per_1k_requests INTEGER
);

-- Internal Apps (unmetered whitelist)
CREATE TABLE internal_apps (
  id UUID PRIMARY KEY,
  app_name VARCHAR(100) UNIQUE,
  client_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Subscriptions (required for non-free tiers)
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(50), -- active, past_due, canceled, unpaid
  plan_id UUID REFERENCES billing_plans(id),
  current_period_start DATE,
  current_period_end DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Pricing Tiers

| Tier | Name | Requests/Month | Price | Price/1K |
|------|------|---------------|-------|----------|
| 0 | Free | 500,000 | $0 | $0.00 |
| 1 | Starter | 750,000 | $25 | $0.10 |
| 2 | Growth | 1,250,000 | $50 | $0.05 |
| 3 | Scale | 2,000,000 | $75 | $0.04 |
| 4 | Enterprise | 2,500,000 | $100 | $0.04 |

### Volume Discount Logic

```typescript
function calculatePrice(requests: number): number {
  if (requests <= 500000) return 0;       // Free tier
  if (requests <= 750000) return 2500;     // $25 flat
  if (requests <= 1250000) return 5000;
  if (requests <= 2000000) return 7500;
  return 10000;                         // $100 for up to 2.5M
}
```

### Free Tier Requirements

- **API key required**: Free tier users must create an API key to access any API
- **No credit card**: Free tier does not require payment method
- **Hard limit at 500k**: Requests stop with 402 Payment Required after 500k
- **Upgrade prompt**: After limit, user directed to `/billing/upgrade`

### User Flow

1. User registers → Free account automatically
2. User creates API key via dashboard
3. User makes API calls with X-API-Key header
4. At 500k requests: 402 Payment Required returned
5. User upgrades via Stripe checkout
6. On payment success: status → active, quota lifted

## Per-Service (À la Carte) Pricing

Each gateway controller group is priced independently:

| Service | Price per 1K requests |
|---------|-------------------|
| social | $0.30 |
| finance | $0.40 |
| blogging | $0.25 |
| store | $0.35 |
| classifieds | $0.25 |
| profile | $0.20 |
| payments | $0.50 |
| project-planning | $0.25 |
| videos | $0.40 |
| wellness | $0.20 |
| forum | $0.25 |
| leads | $0.30 |

## "Everything at the Table" Bundle

- Unlimited access to all metered services
- Price: $150/month (same as Enterprise tier but unlimited across all services)
- Includes all services in per-service list
- Requires active subscription

## Internal Applications (Unmetered)

These apps bypass all metering:

- christopherrutherford-net
- client-interface
- configurable-client
- d6
- digital-homestead
- fin-commander
- forgeofwill
- hai
- leads-app
- local-hub
- owner-console
- system-configurator
- store-client
- video-client

Implementation: Maintain whitelist of `client_id` values in `internal_apps` table. Middleware checks this before metering.

## Security

### Usage Metrics Protection

1. **Key Hash Storage**: Store SHA-256 hash of API keys, never plaintext
2. **Aggregated Only**: External API exposes only daily/monthly totals, not raw request logs
3. **Rate Limiting**: 1000 req/min per API key to prevent enumeration
4. **Audit Logs**: Internal-only logs with request timestamps (not exposed)

### API Key Security

1. Keys displayed once at creation time
2. Regenerate endpoint rotates key
3. Webhook for usage alerts at 80% quota

## API Endpoints

### Public API

```
POST   /api-keys              # Create new API key (any user, including free)
GET    /api-keys            # List user's API keys (names only)
GET    /api-keys/:id       # Get key details (not the key itself)
DELETE /api-keys/:id       # Revoke API key
POST   /api-keys/:id/regen # Regenerate API key

GET    /usage              # Get usage for current key
GET    /usage/:date        # Get usage for specific date
GET    /usage/summary      # Get monthly summary

GET    /plans              # List available plans
POST   /api-keys/:id/plan  # Update key's plan (requires active subscription)

GET    /subscription       # Get current subscription status
POST   /subscription/checkout # Create Stripe checkout session
POST   /subscription/webhook # Stripe webhook for status updates
```

### Protected Endpoints (Internal)

```
GET    /admin/usage/:keyId     # Admin view of key usage
GET    /admin/usage/raw       # Raw usage data (internal only)
POST   /admin/plans          # Create/update plan
POST   /admin/services     # Update service pricing
```

## Middleware Integration

```typescript
// In apps/gateway/src/main.ts
app.use('/api', async (req, res, next) => {
  // Skip metering for internal apps
  if (isInternalApp(req.clientId)) {
    return next();
  }

  // Require API key for all external requests (including free tier)
  if (!req.apiKeyId) {
    return res.status(401).json({ 
      error: 'API key required',
      message: 'Include your API key in X-API-Key header'
    });
  }

  // Check subscription status for non-free plans
  const subscription = await getSubscription(req.userId);
  if (subscription?.status === 'unpaid' || subscription?.status === 'past_due') {
    return res.status(402).json({ 
      error: 'Payment required',
      message: 'Subscription inactive. Please update payment method.',
      upgrade_url: '/billing/upgrade'
    });
  }

  // Skip metering for non-metered endpoints
  if (!isMeteredEndpoint(req.path)) {
    return next();
  }

  // Track usage
  await trackUsage(req.apiKeyId, getServiceName(req.path), req.path);

  // Check quota
  const usage = await getCurrentUsage(req.apiKeyId);
  const plan = await getPlan(req.planId);

  // Free tier hard stop at 500k
  if (plan.tierLevel === 0 && usage.total >= 500000) {
    return res.status(402).json({ 
      error: 'Payment required',
      message: 'Free tier limit reached. Upgrade to continue.',
      upgrade_url: '/billing/upgrade'
    });
  }

  // Paid tier soft limit (429 at limit)
  if (usage.total >= plan.limit && !plan.isUnlimited) {
    return res.status(429).json({ error: 'Quota exceeded' });
  }

  next();
});
```

### Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 401 | `API_KEY_REQUIRED` | No API key provided |
| 402 | `PAYMENT_REQUIRED` | Free tier limit or unpaid subscription |
| 429 | `QUOTA_EXCEEDED` | Paid tier limit reached |

## Dashboard

### Tech Stack

- Use existing `client-interface` architecture
- Embed Swagger UI/OpenAPI viewer
- Serve specs from `/openapi.yaml`

### Features

1. **API Key Management**
   - Create/regenerate/revoke keys
   - Assign plans
   - View usage dashboard

2. **Usage Analytics**
   - Daily/weekly/monthly charts (bar chart)
   - Per-service breakdown (pie chart)
   - Usage alerts configuration

3. **API Documentation**
   - Auto-generated from gateway OpenAPI specs
   - Try-it-out functionality
   - Code generation snippets

## Migration Path

1. **Phase 1**: Create database tables, existing keys work at unlimited
2. **Phase 2**: Add middleware tracking without blocking
3. **Phase 3**: Add plan enforcement (soft - warn only)
4. **Phase 4**: Hard enforcement, per-service tracking
5. **Phase 5**: Dashboard and self-service

## Files to Create

```
apps/
  usage-tracker/
    src/
      usage-tracker.module.ts
      usage.service.ts
      metrics.controller.ts
      middleware/usage.middleware.ts
  
  api-key-service/
    src/
      api-key.module.ts
      api-key.controller.ts
      api-key.service.ts
      plans.controller.ts
      plans.service.ts
  
  developer-portal/
    src/
      developer-portal.module.ts
      dashboard.controller.ts
      usage-analytics.controller.ts
      openapi.controller.ts (serve spec)
```

## Testing

1. Unit tests for pricing calculations
2. Integration tests for middleware
3. E2E tests for key creation flow
4. Load test for usage tracking

## Success Criteria

- All external API keys metered correctly
- Internal apps never counted
- Dashboard shows accurate usage
- OpenAPI docs load without error
- Plan upgrades work without downtime