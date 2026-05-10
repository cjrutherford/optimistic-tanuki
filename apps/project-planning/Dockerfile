FROM docker.io/node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/project-planning/ ./apps/project-planning/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build project-planning --configuration=development

FROM docker.io/node:24-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3006
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/package.json ./package.json
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w nodemon pg
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w pg
COPY --from=builder /usr/src/app/dist/apps/project-planning ./dist/apps/project-planning
RUN chown -R node:node .
USER node
EXPOSE 3006
CMD ["dumb-init", "node", "dist/apps/project-planning/main.js"]
