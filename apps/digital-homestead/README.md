# Digital Homestead

`digital-homestead` is a frontend application in the monorepo with its main source under `apps/digital-homestead/src/app` and supporting UI components under `src/app/components`.

## Local Development

Run it through the repo stack:

```bash
npm run docker:dev
```

Primary local URL:

- `http://localhost:8082`

For direct Nx work:

```bash
npx nx serve digital-homestead
npx nx build digital-homestead
```

## Repo Role

- one of the deployed client applications in the repo
- included in the Docker and k8s image promotion flow
