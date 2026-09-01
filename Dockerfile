FROM node:26-alpine AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM node:26-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL
ARG SAPIENWORX_PUBLIC_SITE_URL
ARG DEPLOYMENT_VERSION
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV SAPIENWORX_PUBLIC_SITE_URL=$SAPIENWORX_PUBLIC_SITE_URL
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=next_server_actions_encryption_key,required=false \
    if [ -f /run/secrets/next_server_actions_encryption_key ]; then \
      export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_encryption_key)"; \
    fi; \
    npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ARG SAPIENWORX_PUBLIC_SITE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SAPIENWORX_PUBLIC_SITE_URL=$SAPIENWORX_PUBLIC_SITE_URL

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
