FROM node:22-alpine AS base
WORKDIR /app

# --- dev target ---
FROM base AS dev
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
CMD ["sh", "-c", "sleep 3 && npx prisma migrate deploy && npx tsx prisma/seed/seed.ts --clear --hours=24 && npx tsx scripts/seed-live.ts & npm run dev"]
