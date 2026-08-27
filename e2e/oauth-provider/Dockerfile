FROM node:24-alpine

WORKDIR /app
COPY e2e/oauth-provider/server.mjs ./server.mjs

EXPOSE 3016
CMD ["node", "server.mjs"]
