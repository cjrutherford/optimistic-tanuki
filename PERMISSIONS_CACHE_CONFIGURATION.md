# Permissions Cache Configuration Guide

## Overview
The permissions system supports three cache providers to suit different deployment scenarios:
- **Memory Cache**: Fast, in-process cache (default)
- **File Cache**: Persistent file-based cache
- **Redis Cache**: Distributed cache for multi-instance deployments

## Configuration

### Location
Configuration is specified in `apps/gateway/src/assets/config.yaml` under the `permissions.cache` section.

### Memory Cache (Default)

Best for: Single-instance deployments, development

```yaml
permissions:
  cache:
    provider: memory
    ttl: 300000       # 5 minutes in milliseconds
    maxSize: 10000    # Maximum number of cache entries
```

**Characteristics:**
- ✅ Fastest performance (~1ms lookups)
- ✅ No external dependencies
- ✅ No disk I/O
- ❌ Does not persist across restarts
- ❌ Not shared across multiple instances
- 💾 Memory usage: ~1MB for 10,000 entries

### File Cache

Best for: Single-instance deployments requiring persistence

```yaml
permissions:
  cache:
    provider: file
    ttl: 300000       # 5 minutes in milliseconds
    maxSize: 10000    # Maximum number of cache entries
    cacheDir: /var/cache/permissions  # Cache directory path
```

**Characteristics:**
- ✅ Persists across restarts
- ✅ No external dependencies
- ✅ Survives process crashes
- ❌ Slower than memory (~10-50ms lookups)
- ❌ Not shared across multiple instances
- 💾 Disk usage: ~100 bytes per entry

**Requirements:**
- Directory must be writable by the gateway process
- Sufficient disk space for cache files
- Recommended: SSD for better performance

### Redis Cache

Best for: Multi-instance deployments, microservices architecture

```yaml
permissions:
  cache:
    provider: redis
    ttl: 300000       # 5 minutes in milliseconds
    redis:
      host: redis.example.com
      port: 6379
      password: your-secure-password  # Optional
      db: 0                          # Redis database number
      keyPrefix: 'permissions:'      # Key prefix for namespace isolation
```

**Characteristics:**
- ✅ Shared across multiple gateway instances
- ✅ Persists across restarts (with Redis persistence)
- ✅ Scalable and distributed
- ✅ Automatic TTL expiration
- ❌ Requires Redis server
- ❌ Network latency (~2-5ms local, higher for remote)
- 💾 Redis memory usage: ~100 bytes per entry

**Requirements:**
- Redis server 6.0 or higher
- Network connectivity to Redis
- Install Redis client: `npm install redis`

## Configuration Parameters

### Common Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `provider` | string | `memory` | Cache provider: `memory`, `file`, or `redis` |
| `ttl` | number | `300000` | Time to live in milliseconds (5 minutes) |
| `maxSize` | number | `10000` | Max entries (memory/file only) |

### File-Specific Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cacheDir` | string | `/tmp/permissions-cache` | Directory for cache files |

### Redis-Specific Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `redis.host` | string | `localhost` | Redis server hostname |
| `redis.port` | number | `6379` | Redis server port |
| `redis.password` | string | - | Redis password (optional) |
| `redis.db` | number | `0` | Redis database number |
| `redis.keyPrefix` | string | `permissions:` | Key prefix for cache entries |

## Environment-Specific Configurations

### Development
```yaml
permissions:
  cache:
    provider: memory
    ttl: 60000  # 1 minute for faster testing
    maxSize: 1000
```

### Staging
```yaml
permissions:
  cache:
    provider: file
    ttl: 300000
    maxSize: 5000
    cacheDir: /var/cache/permissions-staging
```

### Production (Single Instance)
```yaml
permissions:
  cache:
    provider: file
    ttl: 300000
    maxSize: 10000
    cacheDir: /var/cache/permissions
```

### Production (Multi-Instance)
```yaml
permissions:
  cache:
    provider: redis
    ttl: 300000
    redis:
      host: redis.production.internal
      port: 6379
      password: ${REDIS_PASSWORD}  # From environment variable
      db: 0
      keyPrefix: 'permissions:prod:'
```

## Performance Comparison

| Provider | Lookup Time | Memory/Disk | Persistence | Multi-Instance | Setup Complexity |
|----------|-------------|-------------|-------------|----------------|------------------|
| Memory | ~1ms | 1MB (10k) | No | No | ⭐ Simple |
| File | ~10-50ms | 1MB disk | Yes | No | ⭐⭐ Medium |
| Redis | ~2-5ms | Redis RAM | Yes | Yes | ⭐⭐⭐ Complex |

## Cache Key Structure

Cache keys follow this pattern:
```
{profileId}:{permission}:{appScopeId}:{targetId}
```

Example:
```
user123:blog.post.create:blogging-scope:null
user456:asset.delete:assets-scope:asset789
```

## Cache Invalidation

### Manual Invalidation API

The `PermissionsCacheService` provides methods for cache invalidation:

```typescript
// Invalidate all permissions for a user
await permissionsCacheService.invalidateProfile('user123');

// Invalidate all permissions for an app scope
await permissionsCacheService.invalidateAppScope('blogging');

// Clear entire cache
await permissionsCacheService.clear();
```

### Automatic Invalidation

Call invalidation methods when:
- User roles change
- Permissions are added/removed from roles
- Role-permission mappings change
- App scope configurations change

Example integration:
```typescript
@Post('/roles/assign')
async assignRole(@Body() dto: AssignRoleDto) {
  await this.rolesService.assignRole(dto);
  
  // Invalidate user's cached permissions
  await this.permissionsCacheService.invalidateProfile(dto.profileId);
  
  return { success: true };
}
```

## Monitoring

### Cache Statistics

Get cache statistics programmatically:

```typescript
const stats = await permissionsCacheService.getStats();
console.log(stats);
// {
//   provider: 'memory',
//   size: 1234,
//   maxSize: 10000,
//   ttlMs: 300000,
//   hits: 5678,
//   misses: 234
// }
```

### Metrics to Monitor

1. **Cache Hit Rate**: `hits / (hits + misses)`
   - Target: >90%
   - Low hit rate indicates TTL too short or cache too small

2. **Cache Size**: Current number of entries
   - Monitor growth over time
   - Adjust `maxSize` if frequently hitting limit

3. **Eviction Rate**: Entries evicted due to size limits
   - High eviction rate suggests increasing `maxSize`

### Health Checks

For Redis provider, monitor:
- Connection status
- Redis server health
- Network latency
- Redis memory usage

## Troubleshooting

### Issue: Low Cache Hit Rate

**Symptoms**: High number of cache misses, performance not improved

**Solutions**:
1. Increase TTL: `ttl: 600000` (10 minutes)
2. Increase cache size: `maxSize: 20000`
3. Check if permissions are being invalidated too frequently

### Issue: Redis Connection Failures

**Symptoms**: Logs show "Redis not connected" warnings

**Solutions**:
1. Verify Redis server is running: `redis-cli ping`
2. Check network connectivity: `telnet redis-host 6379`
3. Verify credentials: `redis-cli -a password ping`
4. Check Redis logs for errors

### Issue: High Memory Usage

**Symptoms**: Memory consumption growing over time

**Solutions**:
1. Reduce cache size: `maxSize: 5000`
2. Reduce TTL: `ttl: 180000` (3 minutes)
3. For file cache: Check disk space and clean up old files
4. For Redis: Monitor Redis memory usage and configure `maxmemory`

### Issue: Stale Permissions

**Symptoms**: Users retain permissions after revocation

**Solutions**:
1. Reduce TTL: `ttl: 60000` (1 minute)
2. Implement proper invalidation on permission changes
3. Add explicit cache clear on critical operations

## Migration Guide

### From Memory to File Cache

1. Update configuration:
```yaml
permissions:
  cache:
    provider: file
    cacheDir: /var/cache/permissions
```

2. Create cache directory:
```bash
sudo mkdir -p /var/cache/permissions
sudo chown gateway-user:gateway-group /var/cache/permissions
```

3. Restart gateway service

### From Memory/File to Redis Cache

1. Install Redis:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:7
```

2. Install Redis client:
```bash
npm install redis
```

3. Update configuration:
```yaml
permissions:
  cache:
    provider: redis
    redis:
      host: localhost
      port: 6379
```

4. Restart gateway service

5. Verify Redis connection in logs

## Best Practices

1. **Choose the Right Provider**:
   - Development: memory
   - Single production instance: file
   - Multi-instance production: redis

2. **Set Appropriate TTL**:
   - Short TTL (1-2 min): Frequently changing permissions
   - Medium TTL (5-10 min): Normal use case
   - Long TTL (15-30 min): Rarely changing permissions

3. **Monitor Performance**:
   - Track cache hit rates
   - Monitor memory/disk usage
   - Alert on Redis connection failures

4. **Implement Invalidation**:
   - Always invalidate on permission changes
   - Consider scheduled full cache clears (e.g., daily)

5. **Security**:
   - Use strong Redis passwords in production
   - Limit Redis network access with firewall rules
   - Encrypt Redis connections with TLS if over network

6. **Testing**:
   - Test with low TTL in development
   - Verify invalidation works correctly
   - Load test with realistic cache patterns

## Example: Complete Production Setup

### 1. Docker Compose with Redis
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --requirepass your-secure-password
    
  gateway:
    build: ./apps/gateway
    environment:
      REDIS_PASSWORD: your-secure-password
    depends_on:
      - redis

volumes:
  redis-data:
```

### 2. Gateway Configuration
```yaml
permissions:
  cache:
    provider: redis
    ttl: 300000
    redis:
      host: redis
      port: 6379
      password: ${REDIS_PASSWORD}
      db: 0
      keyPrefix: 'permissions:prod:'
```

### 3. Monitoring Script
```typescript
// monitor-cache.ts
setInterval(async () => {
  const stats = await permissionsCacheService.getStats();
  const hitRate = stats.hits / (stats.hits + stats.misses) * 100;
  
  console.log({
    provider: stats.provider,
    size: stats.size,
    hitRate: hitRate.toFixed(2) + '%',
    totalRequests: stats.hits + stats.misses
  });
}, 60000); // Every minute
```

## Conclusion

The configurable cache system provides flexibility for different deployment scenarios while maintaining consistent permission checking behavior. Choose the provider that best fits your infrastructure and monitoring capabilities.
