FROM node:20-alpine

WORKDIR /app

COPY e2e/mock-payment-server/package.json e2e/mock-payment-server/payment-server.js ./

RUN npm install

EXPOSE 3019

CMD ["node", "payment-server.js"]