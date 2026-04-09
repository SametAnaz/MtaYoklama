FROM node:20-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
# Raspberry Pi (ARM) üzerinde better-sqlite3 gibi native modüllerin derlenebilmesi için gereken araçlar
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry kapatıldı
ENV NEXT_TELEMETRY_DISABLED=1

# Projeyi derle (npm run build, next.config.ts'deki output: 'standalone' ayarını kullanır)
RUN npm run build

# Production image, sadece gereken dosyaları kopyala
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Public klasöründeki statik medya vb. (mtabanner.png dahil) taşınır
COPY --from=builder /app/public ./public

# İzinlerin ayarlanması
RUN mkdir .next
RUN chown nextjs:nodejs .next

# SQLite veritabanı için kullanılacak "data" klasörünü oluştur ve izin ver
RUN mkdir data
RUN chown nextjs:nodejs data

# Standalone output dosyalarını kopyala
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

# server.js next build tarafından 'standalone' modunda oluşturulur
CMD ["node", "server.js"]
