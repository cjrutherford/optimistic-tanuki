FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/finance/ ./apps/finance/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build finance --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3019
WORKDIR /usr/src/app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && pnpm add -g nodemon
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
COPY --from=builder /usr/src/app/dist/apps/finance/ ./
RUN node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); pkg.dependencies={...(pkg.dependencies||{}), pg:'8.20.0', tslib:'2.8.1', typeorm:'0.3.28'}; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)+'\n');"
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
USER node
EXPOSE 3019
CMD ["dumb-init", "node", "main.js"]
