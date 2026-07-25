# ── base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --ignore-scripts

# ── dev ──────────────────────────────────────────────────────────────────────
FROM base AS dev
ENV NODE_ENV=development
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ── prod ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
