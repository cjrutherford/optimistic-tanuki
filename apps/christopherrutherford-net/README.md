# Christopher Rutherford Net

`christopherrutherford-net` is the frontend for the personal site experience in this monorepo. Its source lives under `apps/christopherrutherford-net/src` with landing-page sections split into focused folders such as `hero`, `about`, `contact`, and `project-grid`.

## Local Development

Run it with the main stack:

```bash
pnpm run docker:dev
```

Primary local URL:

- `http://localhost:8083`

For direct Nx work:

```bash
pnpm exec nx serve christopherrutherford-net
pnpm exec nx build christopherrutherford-net
```

## Repo Role

- public-facing site frontend
- deployed as part of the current client image matrix and k8s overlay surface
