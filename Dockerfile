FROM node:22-alpine AS base
WORKDIR /app

# Install Python for RTSP collector
FROM python:3.11-slim AS python-base
WORKDIR /app
RUN apt-get update && apt-get install -y \
    libxml2-dev \
    libxslt1-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- dev target ---
FROM base AS dev
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
CMD ["sh", "-c", "sleep 3 && npx prisma migrate deploy && npx tsx scripts/seed-if-empty.ts && npx tsx scripts/seed-live.ts & npm run dev"]

# --- collector target ---
FROM python-base AS collector
WORKDIR /app
COPY . .
CMD ["python3", "rtsp_metadata_temp_collector.py", "--from-db", "--interval-seconds", "60"]
