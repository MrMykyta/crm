FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache bash curl wget
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chmod +x ./scripts/entrypoint.sh
EXPOSE 3000
CMD ["./scripts/entrypoint.sh"]