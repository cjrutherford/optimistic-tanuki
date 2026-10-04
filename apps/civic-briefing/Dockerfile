FROM docker.io/node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/civic-briefing/ ./apps/civic-briefing/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build civic-briefing --configuration=production

FROM docker.io/node:24-alpine AS runner
# The document adapter OCRs scanned PDFs with pdftoppm and tesseract.
RUN apk add --no-cache dumb-init poppler-utils tesseract-ocr tesseract-ocr-data-eng
ENV NODE_ENV=production
ENV PORT=3028
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile
COPY --from=builder /usr/src/app/dist/apps/civic-briefing/ ./
# The service writes its artifacts and reports under data/, as the node user.
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3028
CMD ["dumb-init", "node", "main.js"]
