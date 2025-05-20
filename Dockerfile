# Build stage
FROM oven/bun:1.2 AS build

WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy all files
COPY . .

# Create a .env file from the example
COPY .env.example .env

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.2-slim

WORKDIR /app

# Copy built assets from the build stage
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./

# Copy the database configuration so that we interact with it in the production environment
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/src/lib/server/db ./src/lib/server/db

# Install only production dependencies
COPY --from=build /app/node_modules ./node_modules

# Expose the port the app will run on
EXPOSE 3000

# Command to run the app
CMD ["bun", "./build"]
