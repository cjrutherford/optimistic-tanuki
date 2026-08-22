FROM node:24-alpine
RUN apk add --no-cache dumb-init nsjail go g++ rust cargo
WORKDIR /app
COPY apps/learning-runner/server.mjs ./server.mjs
USER node
ENV PORT=3025
EXPOSE 3025
CMD ["dumb-init", "node", "server.mjs"]
