# --- Stage 1: Install Dependencies ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Clean install including devDependencies
RUN npm ci

# --- Stage 2: Build the App ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run your complex build script (tsc, vite, sw-scripts)
RUN npm run build

# THE TRICK: Delete everything NOT needed for production
# This removes the 150MB+ of compilers/linters we just identified
RUN npm prune --production

# --- Stage 3: Production Runtime ---
FROM node:24-alpine AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy only the compiled results and the "pruned" node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Security: run as non-root user
USER node

EXPOSE 3000

# Start using the server-side entry point
CMD ["npm", "start"]
