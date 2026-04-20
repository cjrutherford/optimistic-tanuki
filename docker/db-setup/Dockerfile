FROM node:lts-alpine

RUN apk add --no-cache postgresql-client bash

WORKDIR /workspace

RUN corepack enable

CMD ["pnpm", "run", "db:setup"]
