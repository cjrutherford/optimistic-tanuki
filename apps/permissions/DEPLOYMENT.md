# Permissions System Deployment Guide

This guide covers how the permissions service fits into the current local and Kubernetes deployment surface.

## Local Development

For normal local work, use the repo dev stack:

```bash
pnpm install
pnpm run docker:dev
```

That starts the permissions service as part of the main development stack and wires it to the rest of the platform through the gateway.

Expected local behavior:

- permissions service on port `3012`
- gateway on port `3000`
- migrations handled through the stack bootstrap path

Useful checks:

```bash
docker logs ot_permissions
curl http://localhost:3000/permissions/role
```

## Kubernetes and CI

The repo’s k8s deployment path is inventory-driven.

The permissions service is part of the canonical app inventory exported by:

```bash
cd tools/admin-env-wizard
go run ./cmd/deployment-inventory
```

That inventory is validated against:

- `.github/workflows/build-push.yml`
- `k8s/base/kustomization.yaml`
- `k8s/overlays/staging/kustomization.yaml`
- `k8s/overlays/production/kustomization.yaml`

Related scripts:

- `scripts/validate-deployment-inventory.mjs`
- `scripts/validate-compose-k8s-parity.sh`
- `scripts/update-k8s-overlay-images.mjs`

## API Checks

Create a permission:

```bash
curl -X POST http://localhost:3000/permissions/permission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "test:resource:read",
    "description": "Test read permission",
    "resource": "test_resource",
    "action": "read"
  }'
```

Create a role:

```bash
curl -X POST http://localhost:3000/permissions/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "test_role",
    "description": "Test role for development",
    "appScope": "global"
  }'
```

Check a permission:

```bash
curl -X POST http://localhost:3000/permissions/check-permission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "permission": "test:resource:read",
    "appScope": "global"
  }'
```

## Troubleshooting

### Service will not start

```bash
docker logs ot_permissions
```

Check for:

- database connectivity
- missing migrations
- port conflicts
- a partially started dev stack

### Gateway cannot reach permissions

Check:

```bash
docker logs ot_gateway
docker ps | rg permissions
```

Also verify the gateway config and that the full dev stack is up through `pnpm run docker:dev`.
