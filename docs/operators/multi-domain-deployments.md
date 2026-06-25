---
title: Multi-Domain Deployments
summary: Operate the platform across multiple public domains with either a separate nginx host or Kubernetes ingress, while keeping routing, TLS, registry, and origin policy aligned.
category: operators
audience: operator
section: operators
parent: docs/operators/overview
docRole: guide
order: 4
tags:
  - nginx
  - k8s
  - ingress
  - domains
  - tls
---

# Multi-Domain Deployments

## When To Use

Use this page when you are exposing the platform on real public domains and need the domain map to stay consistent across:

- edge routing
- TLS certificates
- gateway trusted-origin handling
- runtime app registry
- websocket routing

This guide treats these two production patterns as equally valid:

1. a separate nginx host forwarding to the compose machine
2. Kubernetes ingress routing directly to in-cluster services

## Source Of Truth

For public routing, treat these three artifacts as one contract:

1. public edge config
   - nginx vhosts or Kubernetes Ingress
2. runtime app registry
   - the registry mounted into gateway through `APP_REGISTRY_PATH`
3. public DNS and TLS coverage
   - the actual hostnames and certificates users hit

If any one of those diverges, browser mutations, OAuth callbacks, websocket connections, and cross-app navigation can fail in ways that look unrelated.

## Current Public Domain Matrix

These are the domains the operator examples now assume:

- `christopherrutherford.net`
- `digital-homestead.christopherrutherford.net`
- `optimistic-tanuki.com`
- `forgeofwill.com`
- `towne-square.com`
- `hopefulaspirationsindustries.com`
- `hardware.hopefulaspirationsindustries.com`
- `store.hopefulaspirationsindustries.com`
- `fin-commander.experiments.christopherrutherford.net`
- `lead-tracker.experiments.christopherrutherford.net`
- `video.experiments.christopherrutherford.net`
- `business.experiments.christopherrutherford.net`

If a host is public, it must exist in both the edge routing layer and the runtime registry.

## Pattern 1: Separate Nginx Host

Use the nginx host pattern when:

- the platform still runs primarily on Docker Compose
- the public entrypoint is a machine different from the app host
- you want a stable edge while backend infrastructure changes underneath it

The tracked operator examples for this path are:

- [Tanuki Nginx Reverse Proxy](./tanuki-nginx-reverse-proxy.md)
- [docs/operators/nginx](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx)

Key operating rules:

- use `tanuki-upstream-host.inc` to inject the real backend machine hostname at deploy time
- keep `/api` and `/ws` same-origin from the browser’s perspective
- keep the runtime registry aligned with the public hostnames, not the internal upstream host

## Pattern 2: Kubernetes Ingress

Use Kubernetes ingress when:

- the apps and gateway are running in-cluster
- you want TLS, routing, and rollout behavior handled by the cluster
- you are ready to remove dependence on a separate reverse-proxy host

The checked-in cluster ingress manifests now split into two roles:

- [`k8s/base/ingress.yaml`](/home/cjrutherford/workspace/optimistic-tanuki/k8s/base/ingress.yaml)
- [`k8s/base/tailscale-ingress.yaml`](/home/cjrutherford/workspace/optimistic-tanuki/k8s/base/tailscale-ingress.yaml)

- `ingress.yaml` is the public multi-domain nginx ingress reference
- `tailscale-ingress.yaml` remains the tailnet-oriented ingress surface

A production-oriented sample is also provided here:

- [multi-domain-ingress.sample.yaml](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/k8s/multi-domain-ingress.sample.yaml)

Recommended ingress pattern:

- route `/` to the host’s frontend service
- route `/api` to `gateway:3000`
- route `/ws` to the gateway websocket port required by that host
- terminate TLS at ingress with Kubernetes TLS secrets kept in sync from certbot

## What Can Go Wrong

### Domain Map Drift

Symptom:

- login works on one host and fails on another
- OAuth callbacks land on the wrong app
- gateway rejects browser mutations with trusted-origin errors

Cause:

- nginx or ingress host rules changed, but the mounted registry did not

Recovery:

- compare public hosts in edge config against registry `uiBaseUrl` values
- restart gateway after registry updates

### TLS Secret Coverage Gaps

Symptom:

- one domain works, another shows certificate warnings
- subdomains fail after cutover

Cause:

- certificate SANs or wildcard coverage do not match the real host list

Recovery:

- audit every public host against the certbot certificate set and the Kubernetes TLS secret contents
- prefer explicit host grouping by apex domain

## Certbot With Kubernetes Ingress

This repo’s ingress manifests assume nginx ingress terminates TLS from standard
`kubernetes.io/tls` secrets. They do not assume `cert-manager`.

If you want certbot to remain the certificate authority workflow, use this
contract:

- certbot obtains and renews the certificates outside the app manifests
- each certificate group is synced into the cluster as a TLS secret
- ingress references those stable secret names
- renewals re-apply the same secret names in place

Recommended grouping:

- `christopherrutherford-net-public-tls`
  - `christopherrutherford.net`
  - `digital-homestead.christopherrutherford.net`
  - `fin-commander.experiments.christopherrutherford.net`
  - `lead-tracker.experiments.christopherrutherford.net`
  - `video.experiments.christopherrutherford.net`
  - `business.experiments.christopherrutherford.net`
- `optimistic-tanuki-public-tls`
  - `optimistic-tanuki.com`
- `forgeofwill-public-tls`
  - `forgeofwill.com`
- `hopefulaspirationsindustries-public-tls`
  - `hopefulaspirationsindustries.com`
  - `hardware.hopefulaspirationsindustries.com`
  - `store.hopefulaspirationsindustries.com`
- `towne-square-public-tls`
  - `towne-square.com`

The certbot sync step can be modeled with `kubectl create secret tls ... --dry-run=client -o yaml | kubectl apply -f -` during deployment or renewal automation. The critical constraint is that the secret names in ingress stay stable.

### Bypassing The Intended Edge

Symptom:

- behavior differs depending on whether traffic enters through ingress, nginx, or a direct service IP

Cause:

- client services remain exposed as `LoadBalancer` and traffic bypasses the ingress layer

Recovery:

- for public cluster deployments, prefer `ClusterIP` behind ingress unless a service must be directly exposed
- treat direct `LoadBalancer` exposure as an exception with a documented reason

### Websocket Port Mismatch

Symptom:

- HTTP works but live chat or social features fail

Cause:

- host points `/ws` to the wrong gateway websocket port
- ingress or nginx upgrade headers are missing

Recovery:

- confirm the host’s websocket dependency
- `optimistic-tanuki.com` expects gateway social websocket `3301`
- `forgeofwill.com` and `towne-square.com` expect gateway chat websocket `3300`

### Mixed API Origin Strategies

Symptom:

- one app uses same-origin `/api`, another calls an absolute API host, and browser policy differs between them

Cause:

- inconsistent frontend deployment assumptions across apps

Recovery:

- standardize on browser-visible same-origin `/api`
- if ingress handles `/api` explicitly, do that consistently for every public host

### Ingress Path Precedence Errors

Symptom:

- `/api` or `/ws` hits the frontend instead of gateway

Cause:

- catch-all `/` route wins because path rules were modeled incorrectly

Recovery:

- ensure `/api` and `/ws` rules are present on each host before the catch-all `/`
- test those paths explicitly after every manifest change

### Readiness And Probe Mismatch

Symptom:

- ingress sends traffic to pods that still fail user requests

Cause:

- readiness probes prove only a narrow health endpoint, not the full end-user path

Recovery:

- keep probes, but also test public host + `/api` + websocket behavior after rollout

### Tailscale And Public Ingress Drift

Symptom:

- internal tailnet URLs work but public domains do not, or vice versa

Cause:

- the Tailscale ingress set and the public ingress set evolved separately

Recovery:

- treat Tailscale ingress as a separate edge surface with its own explicit host inventory
- do not assume public-domain fixes automatically carry over

## Migration Checklist: Nginx Host To Kubernetes

1. Freeze the public host inventory.
2. Ensure the runtime registry matches those hosts exactly.
3. Model the same host inventory in ingress manifests.
4. Confirm certbot covers the full host set and sync the resulting certificate files into the ingress TLS secret names.
5. Route `/api` and `/ws` deliberately per host instead of relying on accidental frontend proxy behavior.
6. Reduce public-facing client and gateway services to `ClusterIP` if ingress is the authoritative edge.
7. Test each public host for:
   - page load
   - login
   - `/api` response
   - websocket connection where applicable
8. Cut DNS gradually if possible and watch for stale resolution.

## Deployment Checklist

1. Issue or renew the public certificates with certbot for the exact host groups above.
2. Sync each certbot certificate and private key pair into the cluster:
   - `christopherrutherford-net-public-tls`
   - `optimistic-tanuki-public-tls`
   - `forgeofwill-public-tls`
   - `hopefulaspirationsindustries-public-tls`
   - `towne-square-public-tls`
3. Apply the ingress and confirm each host resolves to the nginx ingress controller.
4. Validate `https://<host>/api/health` or equivalent before testing login flows.

## Compose Deployment Checklist

Use this when the public edge is nginx on one machine and the app stack is
Docker Compose on another.

1. Copy [tanuki-upstream-host.inc.sample](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/tanuki-upstream-host.inc.sample) to `/config/nginx/tanuki-upstream-host.inc`.
2. Set the real backend machine in that file:
   - `set $tanuki_upstream_host your-tailnet-host.ts.net;`
   - `set $tanuki_upstream_proto http;`
3. Copy the checked-in nginx includes and vhost files into place:
   - `docs/operators/nginx/tanuki-proxy.inc` to `/config/nginx/tanuki-proxy.inc`
   - `docs/operators/nginx/tanuki-app-server.inc` to `/config/nginx/tanuki-app-server.inc`
   - `docs/operators/nginx/tanuki-app-server-with-ws.inc` to `/config/nginx/tanuki-app-server-with-ws.inc`
   - `docs/operators/nginx/error-pages.inc` to `/config/nginx/error-pages.inc`
   - `docs/operators/nginx/default-site.conf` to `/config/nginx/site-confs/default-site.conf`
   - `docs/operators/nginx/experiments.conf` to `/config/nginx/proxy-confs/experiments.conf`
4. Copy the branded error pages from `docs/operators/nginx/www/_errors/` to `/config/www/_errors/`.
5. Confirm the runtime registry still matches every public host.
6. On the Compose host, set the deployment inputs:
   - `PRODUCTION_IMAGE_TAG=sha-...`
   - optional `COMPOSE_ENV_FILE=/path/to/production.env`
   - optional `DOCKER_PULL_BATCH_SIZE=4`
   - optional `ROLLBACK_IMAGE_TAG=sha-previous`
7. Trigger the rollout through the standard production script:
   - `pnpm run docker:prod:bootstrap`
   - or through `admin-env tui` / `admin-env serve`, which now reuse the same script
8. Inspect rollout state at `tmp/admin-env/rollouts/production.json`.
9. Validate each public host for page load, login, `/api`, and websocket behavior where applicable.

## Files To Inspect

- [tools/registry/apps.production.sample.yaml](/home/cjrutherford/workspace/optimistic-tanuki/tools/registry/apps.production.sample.yaml)
- [docs/operators/tanuki-nginx-reverse-proxy.md](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/tanuki-nginx-reverse-proxy.md)
- [k8s/base/ingress.yaml](/home/cjrutherford/workspace/optimistic-tanuki/k8s/base/ingress.yaml)
- [k8s/base/tailscale-ingress.yaml](/home/cjrutherford/workspace/optimistic-tanuki/k8s/base/tailscale-ingress.yaml)
- [k8s/base/gateway.yaml](/home/cjrutherford/workspace/optimistic-tanuki/k8s/base/gateway.yaml)

## Related Docs

- [Operator Handbook](./overview.md)
- [Deployment Environments](./deployment-environments.md)
- [Tanuki Nginx Reverse Proxy](./tanuki-nginx-reverse-proxy.md)
