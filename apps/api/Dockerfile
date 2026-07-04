# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NX_DAEMON=false
RUN npx nx build api

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/dev.db"
COPY --from=build /app/dist/apps/api ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm install --omit=dev prisma@^6.16.2 && npx prisma generate
EXPOSE 8080
CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma --skip-generate --accept-data-loss && node main.js"]
