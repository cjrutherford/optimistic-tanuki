FROM node:24-alpine AS builder

WORKDIR /usr/src/app

ARG GIT_SHA=unknown

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY tools/docs-site ./tools/docs-site
COPY apps/ui-playground ./apps/ui-playground

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build ui-playground --configuration=production

FROM nginx:1.27-alpine

COPY --from=builder /usr/src/app/dist/apps/ui-playground/browser /usr/share/nginx/html

RUN printf '%s\n' \
    'server {' \
    '  listen 4000;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  location / {' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 4000
