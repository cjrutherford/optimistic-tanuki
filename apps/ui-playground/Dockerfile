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
COPY tools/storybook ./tools/storybook
COPY apps/ui-playground ./apps/ui-playground

# Markdown rendered as Storybook docs pages (tools/docs-site/docs-source.config.json).
COPY docs ./docs
COPY README.md PRODUCT.md CONTRIBUTING.md GOVERNANCE.md ./
COPY apps/authentication/README.md ./apps/authentication/README.md
COPY apps/client-interface/README.md ./apps/client-interface/README.md
COPY apps/gateway/README.md ./apps/gateway/README.md
COPY apps/marketing-generator/README.md ./apps/marketing-generator/README.md
COPY apps/developer-portal/README.md ./apps/developer-portal/README.md
COPY tools/admin-env-wizard/README.md ./tools/admin-env-wizard/README.md
COPY tools/stack-client/README.md ./tools/stack-client/README.md

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
    '  add_header Referrer-Policy "no-referrer" always;' \
    '  location / {' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 4000
