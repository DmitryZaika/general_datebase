# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Run your multi-step build command
# This handles tsc, react-router build, and your custom SW scripts
RUN npm run build

# Remove development dependencies to keep the 'node_modules' lean
RUN npm prune --production

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy only the necessary files from the builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose the port remix-router-serve uses
EXPOSE 3000

# Start the app using the command from your package.json
CMD ["npm", "start"]
