# syntax=docker/dockerfile:1.7

# 1) install ALL deps (need devDependencies for tsc + drizzle-kit)
FROM node:20-alpine AS deps-full
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# 2) compile typescript -> dist/
FROM deps-full AS build
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN npm run build

# 3) install ONLY prod deps for the runtime layer
FROM node:20-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# 4) the actual image we ship: prod deps + compiled js + migration sql
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini
COPY --chown=node:node --from=deps-prod /app/node_modules ./node_modules
COPY --chown=node:node --from=build    /app/dist          ./dist
COPY --chown=node:node drizzle                            ./drizzle
COPY --chown=node:node package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
