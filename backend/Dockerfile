# syntax=docker/dockerfile:1

# ---- deps: install all dependencies (cached until package files change)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript, then drop dev dependencies
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runner: only what's needed to run the compiled app
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
