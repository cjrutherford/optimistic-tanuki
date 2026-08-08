FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/learning-service/ ./apps/learning-service/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build learning-service --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3024
WORKDIR /usr/src/app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && pnpm add nodemon
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
COPY --from=builder /usr/src/app/dist/apps/learning-service/ ./
RUN node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); pkg.dependencies={...(pkg.dependencies||{}), pg:'8.20.0', tslib:'2.8.1', typeorm:'0.3.28', zod:'3.24.2'}; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)+'\n');"
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
USER node
EXPOSE 3024
CMD ["dumb-init", "node", "main.js"]
