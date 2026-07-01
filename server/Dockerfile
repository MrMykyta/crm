FROM node:20-alpine

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --only=production

COPY server/. .
COPY shared ../shared

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

EXPOSE 3000

CMD ["npm", "run", "start:docker"]
