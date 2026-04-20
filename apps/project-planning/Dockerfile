FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/project-planning/ ./apps/project-planning/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build project-planning --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3006
RUN corepack enable && pnpm add nodemon pg
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/project-planning ./dist/apps/project-planning
COPY --from=builder /usr/src/app/package.json ./package.json
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add pg
RUN chown -R node:node .
USER node
EXPOSE 3006
CMD ["dumb-init", "node", "dist/apps/project-planning/main.js"]
