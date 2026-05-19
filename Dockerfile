# Multi-stage build

# Stage 1: Build React frontend
FROM node:20-alpine AS builder

WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/src ./src
COPY client/public ./public
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy server
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --production

COPY server/server.js server/gameLogic.js server/leaderboard.js ./server/

# Copy data (word lists — immutable, baked into image)
COPY data ./data

# State dir (mutable — bind-mounted via docker-compose so it survives rebuilds)
RUN mkdir -p /app/state

# Copy built frontend
COPY --from=builder /app/client/build ./public

EXPOSE 3001

CMD ["node", "server/server.js"]
