FROM node:24-alpine

RUN apk add --no-cache postgresql-client bash

WORKDIR /workspace

RUN corepack enable

CMD ["sh", "./setup-and-migrate.sh"]
