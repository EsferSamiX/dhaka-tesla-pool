# syntax=docker/dockerfile:1

# ---- deps: install all dependencies (cached until package files change)
FROM node:24-alpine AS deps
WORKDIR /app
# prisma files are needed by the postinstall `prisma generate`
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ---- build: compile TypeScript. Keeps dev dependencies, so docker compose
# also uses this stage to run migrations and the seed (Prisma CLI needed).
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod-deps: drop dev dependencies for the runtime image
FROM build AS prod-deps
RUN npm prune --omit=dev

# ---- runner: only what's needed to run the compiled app
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/dist ./dist

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
