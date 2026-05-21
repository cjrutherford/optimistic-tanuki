# Configurable Client - Multi-Tenant App Selection

The configurable-client supports **explicit** multi-tenant app selection through three methods, prioritized in the following order:

## Selection Methods (Priority Order)

### 1. Route Parameter (Highest Priority)
Access via top-level route: `/app/:appName`

**Examples:**
```
http://localhost:8090/app/demo-app
http://localhost:8090/app/my-portfolio
http://mysite.com/app/corporate-site
```

**Use Case:** Explicit app selection when you want users to navigate to specific configurations via URL paths. Perfect for hosting multiple apps on a single domain.

### 2. Hostname/Domain
Access via hostname-based lookup

**Examples:**
```
http://myapp.example.com          → loads config where domain = "myapp.example.com"
http://portfolio.mysite.com       → loads config where domain = "portfolio.mysite.com"
```

**Use Case:** True multi-tenant SaaS deployment where each customer has their own domain/subdomain. The application automatically detects the hostname and loads the corresponding configuration.

**Note:** Localhost and `.local` domains skip this check and fall through to query parameters or defaults.

### 3. Query Parameter (Fallback)
Access via query string: `?appName=xxx`

**Examples:**
```
http://localhost:8090?appName=demo-app
http://localhost:8090?appName=my-portfolio
```

**Use Case:** Development and testing. Convenient for local development without setting up custom domains or routes.

### 4. Default Fallback
If no selection method is provided, loads: **"Demo Application"**

## Configuration Examples

### Example 1: Multi-App Single Domain
Host multiple applications on the same domain using route parameters:

```
https://platform.example.com/app/corporate       → Corporate website config
https://platform.example.com/app/blog            → Blog config
https://platform.example.com/app/portfolio       → Portfolio config
```

### Example 2: Multi-Tenant with Custom Domains
Each customer gets their own domain:

```
https://acme-corp.platform.io                    → ACME Corp config (domain: "acme-corp.platform.io")
https://widget-co.platform.io                    → Widget Co config (domain: "widget-co.platform.io")
```

### Example 3: Development Testing
Test different configurations locally:

```
http://localhost:8090?appName=test-app-1
http://localhost:8090?appName=test-app-2
http://localhost:8090/app/test-app-3
```

## Setting Up Configurations

### In Owner Console Designer

1. Navigate to `/dashboard/app-config`
2. Create or edit a configuration
3. Set the **Name** field (used for route and query parameter selection)
4. Set the **Domain** field (used for hostname-based selection)
5. Save the configuration

**Example Configuration:**
- **Name:** `demo-app`
- **Domain:** `demo.myplatform.com`
- **Description:** Demo Application

This configuration can be accessed via:
- `http://localhost:8090/app/demo-app` (route)
- `http://demo.myplatform.com` (domain)
- `http://localhost:8090?appName=demo-app` (query)

## Technical Implementation

The `AppResolverComponent` handles configuration loading with the following logic:

```typescript
// Priority 1: Route parameter
if (route.paramMap.get('appName')) {
  loadByName(appName);
}

// Priority 2: Hostname (skip localhost/127.0.0.1/*.local)
else if (!isLocalDevelopment) {
  loadByDomain(window.location.hostname);
}

// Priority 3: Query parameter
else if (queryParams['appName']) {
  loadByName(appName);
}

// Priority 4: Default
else {
  loadByName('Demo Application');
}
```

## Docker Deployment

The configurable-client is available at:
- **Container:** `ot_configurable_client`
- **Port:** `8090:4000`

### Environment Variables (Optional)

You can override the default app selection behavior using environment variables:

```yaml
# docker-compose.yaml
configurable-client:
  environment:
    - DEFAULT_APP_NAME=my-default-app  # Changes the default fallback
```

## Error Handling

If a configuration is not found:
- **By Name:** Shows error "Failed to load application configuration for 'xxx'. Configuration not found."
- **By Domain:** Attempts fallback to query parameter, then default
- **All failures:** Displays user-friendly error message with troubleshooting hints

## SSR Considerations

- Configuration loading only occurs in the browser (client-side)
- During SSR, the app shows loading state without fetching configuration
- This ensures fast initial page loads and SEO compatibility
- Actual content renders after configuration is fetched client-side

## Best Practices

1. **Production Deployment:**
   - Use hostname-based selection for true multi-tenant SaaS
   - Configure DNS to point customer domains to your server
   - Set up SSL certificates for each domain

2. **Single-App Deployment:**
   - Use route parameters: `/app/my-app`
   - Or set a default app name in environment variables
   - Remove route parameter requirement for cleaner URLs

3. **Development:**
   - Use query parameters for quick testing: `?appName=test`
   - Use route parameters to test production-like URLs

4. **Testing Multiple Configs:**
   - Set up different configs in designer
   - Test via `http://localhost:8090/app/config-1`, `/app/config-2`, etc.

## API Endpoints Used

- `GET /api/app-config/by-name/:name` - Fetch by name
- `GET /api/app-config/by-domain/:domain` - Fetch by domain
- `GET /api/app-config/:id` - Fetch by ID (not used in selection)
