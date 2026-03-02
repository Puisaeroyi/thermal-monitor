FROM node:22-alpine AS base
WORKDIR /app

# --- dev target ---
FROM base AS dev
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
CMD ["sh", "-c", "sleep 3 && npx prisma migrate deploy && npx tsx scripts/seed-if-empty.ts && npx tsx scripts/seed-live.ts & npm run dev"]
