FROM docker.io/node:24-alpine
RUN apk add --no-cache dumb-init libc6-compat

ARG APP_ROOT=/app
ARG GIT_SHA=unknown

WORKDIR ${APP_ROOT}

ENV NODE_ENV=development
ENV PORT=4000
ENV GIT_SHA=${GIT_SHA}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w nodemon

CMD ["node", "--version"]
