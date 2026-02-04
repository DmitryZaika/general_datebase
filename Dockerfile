# --- Stage 1: Dependencies ---
# We install everything (including devDependencies) here
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci  # 'npm ci' is faster and more reliable than 'install' for Docker

# --- Stage 2: Builder ---
# We copy the node_modules from Stage 1 and build the app
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Remove development dependencies *after* building
# This is the "magic" step to shrink that 588MB
RUN npm prune --production

# --- Stage 3: Runner (The Final Image) ---
# We start with a fresh image and ONLY grab the essentials
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy ONLY the production-ready files
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
