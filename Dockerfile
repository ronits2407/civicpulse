FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json bun.lock ./
RUN npm install -g bun && bun install --frozen-lockfile

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g bun && bun run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
# Install sharp explicitly in the runtime environment to ensure correct binaries
RUN npm install sharp
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]