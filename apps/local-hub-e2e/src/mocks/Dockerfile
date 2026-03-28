ARG MOCK_DIR=apps/local-hub-e2e/src/mocks

FROM node:20-alpine

WORKDIR /app

COPY ${MOCK_DIR}/ ./

RUN npm install

EXPOSE 3019

CMD ["node", "payment-server.ts"]