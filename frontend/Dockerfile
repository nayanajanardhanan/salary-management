# PayScope frontend — multi-stage build: compile the React/TypeScript SPA,
# then serve the static output with nginx. No Node.js runtime ships in the
# final image.

# ---- build stage ----
FROM node:20-slim AS build
WORKDIR /app

# Install dependencies first (cached across rebuilds that only change
# application code), using the existing dependency-management approach
# (npm + package-lock.json, `npm ci` for a reproducible install).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_BASE_URL is resolved by Vite at *build* time (baked into the
# static bundle) — it cannot be changed at container runtime without
# rebuilding. It must be supplied explicitly here for any real deployment;
# see src/api/client.ts and docs/deployment.md. There is no
# deployment-specific default hardcoded in this Dockerfile.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# nginx's own entrypoint/CMD from the base image is used unchanged
# (starts nginx in the foreground); no override needed.
