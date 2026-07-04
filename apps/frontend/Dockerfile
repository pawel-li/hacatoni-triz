# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NX_DAEMON=false
RUN npx nx build frontend --configuration=production

FROM nginx:alpine
COPY apps/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/apps/frontend/browser /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
