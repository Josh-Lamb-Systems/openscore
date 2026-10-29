# syntax=docker/dockerfile:1
# OpenScore production image. One image, two commands:
#   web:    npm run start   (runs migrations unless RUN_MIGRATIONS=false, then serves on :3000)
#   worker: npm run worker  (delivers webhooks)

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
