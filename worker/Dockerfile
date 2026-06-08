# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
# worker has no port. liveness is "the sweep loop touched its heartbeat
# file recently". 90s = 3x the default sweep interval.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD [ -f /tmp/worker-alive ] && \
      [ $(( $(date +%s) - $(stat -c %Y /tmp/worker-alive) )) -lt 90 ]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
