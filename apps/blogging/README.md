# Blogging

The blogging service manages blog posts, comments, and related publishing flows. Its implementation lives under `apps/blogging/src/app` with controllers, entities, and services split by concern.

## Local Development

Run it through the normal repo stack:

```bash
npm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/blogging`

## Repo Role

- backend blog content and comment handling
- supports blog-oriented UIs and shared blogging libraries in the repo
- included in the deployment inventory and k8s image promotion flow

## Nx Commands

```bash
npx nx build blogging
npx nx test blogging
```
