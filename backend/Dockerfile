# Backend image — build context is the REPO ROOT (monorepo workspaces).
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend ./backend
RUN npm --workspace backend run db:generate \
 && npm --workspace backend run build

FROM node:20-alpine AS runner
WORKDIR /app/backend
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
# Hoisted deps live in /app/node_modules; Node resolves upward from /app/backend.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/package.json ./package.json
EXPOSE 3001
# Apply migrations then start (safe: migrate deploy never resets data).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
