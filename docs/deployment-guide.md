# Deployment Guide

Production setup for Thermal Monitor on local or cloud infrastructure.

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Runtime |
| PostgreSQL | 12+ | Primary database |
| npm | 8+ | Package manager |
| Git | 2.30+ | Version control |
| SMTP server | — | Email notifications (optional) |

---

## Development Environment Setup

### 1. Clone & Install

```bash
git clone <repo-url> thermal-monitor
cd thermal-monitor

npm install
```

### 2. Create .env.local

```bash
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/thermal_monitor"

# Required for camera password encryption (generate with: openssl rand -hex 32)
CAMERA_ENCRYPTION_KEY="your-64-character-hex-key-here"

# Optional (email notifications)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
ALERT_FROM_EMAIL="alerts@thermal.local"

# Optional (debug mode)
DEBUG="false"
```

**Important:** The `CAMERA_ENCRYPTION_KEY` must be a 64-character hex string (32 bytes). Store this key securely - if lost, all camera passwords become unrecoverable.

### 3. Initialize Database

```bash
# Create schema + indexes
npm run db:reset

# Load sample data (24 hours)
npm run db:seed

# Optional: Stream live test data
npm run db:seed-live &
```

### 4. Start Development Server

```bash
npm run dev
# Opens http://localhost:3000
```

### 5. Verify Setup

- [ ] Dashboard loads without errors
- [ ] Sidebar nav visible
- [ ] Camera list shows 50+ cameras
- [ ] Latest readings are non-null
- [ ] Dark mode toggle works
- [ ] No console errors in browser DevTools
- [ ] Camera passwords are encrypted in database (check via psql)

---

## Camera Password Encryption

Camera credentials (username/password) are encrypted at rest using AES-256-GCM.

### How It Works

1. **Encryption Key**: Stored in `CAMERA_ENCRYPTION_KEY` env var (64-char hex string)
2. **Format**: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
3. **Algorithm**: AES-256-GCM (authenticated encryption)
4. **Cross-language**: Node.js encrypts, Python collector decrypts

### First-Time Setup

```bash
# Generate encryption key
openssl rand -hex 32

# Add to .env.local
echo 'CAMERA_ENCRYPTION_KEY="<output-from-above>"' >> .env.local
```

### Encrypt Existing Passwords

After adding the key, run the migration script:

```bash
npx tsx scripts/encrypt-existing-passwords.ts
```

This encrypts all existing plain-text passwords in the database. Safe to run multiple times (idempotent).

### Key Management

- **Backup**: Store the encryption key in a secure password manager or vault
- **Rotation**: (Future) Key rotation script planned
- **Loss**: If key is lost, all camera passwords become unrecoverable

### Docker Compose Setup

```yaml
services:
  app:
    environment:
      CAMERA_ENCRYPTION_KEY: ${CAMERA_ENCRYPTION_KEY:-}
```

### Python Collector

The Python collector (`rtsp_metadata_temp_collector.py`) reads directly from the database with `--from-db` flag:

```bash
python3 rtsp_metadata_temp_collector.py \
  --from-db \
  --api-url http://localhost:3000/api/temperature-readings \
  --interval-seconds 60
```

Requires `DATABASE_URL` and `CAMERA_ENCRYPTION_KEY` environment variables.

---

## Local Testing with Docker Compose

### 1. Create docker-compose.yml

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: thermal_monitor
      POSTGRES_USER: thermal
      POSTGRES_PASSWORD: secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U thermal"]
      interval: 10s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI

volumes:
  postgres_data:
```

### 2. Start Services

```bash
docker-compose up -d

# Verify PostgreSQL is ready
docker-compose exec postgres pg_isready -U thermal
```

### 3. Update .env.local

```bash
DATABASE_URL="postgresql://thermal:secure-password@localhost:5432/thermal_monitor"
SMTP_HOST="localhost"
SMTP_PORT="1025"
ALERT_FROM_EMAIL="alerts@thermal.local"
```

### 4. Initialize & Test

```bash
npm run db:reset
npm run db:seed
npm run dev
```

### 5. View Emails

- Open http://localhost:8025 (MailHog web UI)
- Emails sent to SMTP will appear here

### 6. Cleanup

```bash
docker-compose down
docker volume rm thermal-monitor_postgres_data  # Delete data
```

---

## Production Deployment (Self-Hosted)

### 1. Server Requirements

**Minimum (50 cameras):**
- CPU: 2-4 cores
- RAM: 4GB
- Disk: 50GB (SSD recommended)
- Network: 100Mbps

**Recommended (100+ cameras):**
- CPU: 8 cores
- RAM: 16GB
- Disk: 500GB (SSD)
- Network: 1Gbps

**Operating System:** Ubuntu 20.04 LTS or later

### 2. PostgreSQL Setup (Ubuntu)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database user
sudo -u postgres createuser thermal -P  # Prompts for password
sudo -u postgres createdb -O thermal thermal_monitor

# Verify connection
psql -U thermal -h localhost -d thermal_monitor -c "SELECT 1;"
```

### 3. Node.js Setup (Ubuntu)

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node --version   # v18.x.x
npm --version    # 8.x.x
```

### 4. Application Setup

```bash
# Create app directory
sudo mkdir -p /opt/thermal-monitor
sudo chown $USER:$USER /opt/thermal-monitor

# Clone repository
cd /opt/thermal-monitor
git clone <repo-url> .

# Install dependencies
npm install --production

# Create .env.local
cat > .env.local <<EOF
DATABASE_URL="postgresql://thermal:PASSWORD@localhost:5432/thermal_monitor"
SMTP_HOST="mail.example.com"
SMTP_PORT="587"
SMTP_USER="alerts@example.com"
SMTP_PASS="EMAIL_PASSWORD"
ALERT_FROM_EMAIL="alerts@example.com"
NODE_ENV="production"
EOF

# Verify .env.local permissions
chmod 600 .env.local
```

### 5. Build & Initialize

```bash
# Build application
npm run build

# Initialize database
npm run db:reset
npm run db:seed

# Verify build
ls -la .next/
```

### 6. Systemd Service (Auto-Start)

Create `/etc/systemd/system/thermal-monitor.service`:

```ini
[Unit]
Description=Thermal Monitor Dashboard
After=postgresql.service network-online.target
Wants=network-online.target

[Service]
Type=simple
User=thermal
WorkingDirectory=/opt/thermal-monitor
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

# Resource limits
LimitNOFILE=65535
MemoryLimit=4G

[Install]
WantedBy=multi-user.target
```

Enable & start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable thermal-monitor
sudo systemctl start thermal-monitor

# Verify
sudo systemctl status thermal-monitor
sudo journalctl -u thermal-monitor -f
```

### 7. Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/thermal-monitor`:

```nginx
upstream thermal_monitor {
  server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
}

server {
  listen 80;
  server_name thermal.example.com;

  # Redirect HTTP → HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name thermal.example.com;

  ssl_certificate /etc/letsencrypt/live/thermal.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/thermal.example.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;

  # Compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;

  location / {
    proxy_pass http://thermal_monitor;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/thermal-monitor \
           /etc/nginx/sites-enabled/thermal-monitor

sudo nginx -t
sudo systemctl restart nginx
```

### 8. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --nginx -d thermal.example.com

# Auto-renewal (runs daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify renewal
sudo certbot renew --dry-run
```

### 9. Database Backup (Automated)

Create `/opt/thermal-monitor/backup.sh`:

```bash
#!/bin/bash
set -e

DB_NAME="thermal_monitor"
DB_USER="thermal"
BACKUP_DIR="/backups/thermal-monitor"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Full backup
pg_dump -U "$DB_USER" -F c -b -v -f "$BACKUP_DIR/backup_$DATE.dump" "$DB_NAME"

# Keep last 7 days
find "$BACKUP_DIR" -name "backup_*.dump" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.dump"
```

Add to crontab (daily at 2am):

```bash
sudo crontab -e

# Add line:
0 2 * * * /opt/thermal-monitor/backup.sh >> /var/log/thermal-backup.log 2>&1
```

### 10. Monitoring & Alerts

#### Health Check Endpoint (Optional)

Add to `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[health]", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
```

#### Uptime Monitoring

```bash
# Check service every 5 minutes
*/5 * * * * curl -f https://thermal.example.com/api/health || \
  mail -s "Thermal Monitor DOWN" ops@example.com
```

#### Log Monitoring

```bash
# Monitor application logs for errors
tail -f /var/log/syslog | grep thermal-monitor
```

---

## Production Checklist

### Pre-Deployment

- [ ] Database credentials generated (strong password)
- [ ] .env.local secured (chmod 600)
- [ ] SMTP credentials configured + tested
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Backup strategy in place
- [ ] Firewall rules configured (allow 80, 443 only)
- [ ] Database backups automated
- [ ] Health check endpoint tested

### Deployment

- [ ] Application builds without errors (`npm run build`)
- [ ] Database migrations applied (`npm run db:reset`)
- [ ] Seed data loaded (sample cameras)
- [ ] Systemd service enabled + started
- [ ] Nginx reverse proxy configured + tested
- [ ] SSL certificate verified in browser
- [ ] Dashboard accessible at https://thermal.example.com
- [ ] API endpoints responding (curl tests)

### Post-Deployment

- [ ] Monitor application logs (first 24h)
- [ ] Verify database backups running
- [ ] Test alert email functionality
- [ ] Load test with 50+ cameras
- [ ] Dark mode toggle verified
- [ ] Drag-drop dashboard tested
- [ ] Alert acknowledgment tested
- [ ] All pages responsive on mobile

### Security Hardening

- [ ] Firewall rules locked down
- [ ] SSH key authentication only (no passwords)
- [ ] Fail2ban configured for brute-force protection
- [ ] Regular security updates applied
- [ ] No console.log secrets in production builds
- [ ] Database password rotated post-deployment
- [ ] SMTP password stored in .env.local only
- [ ] API rate limiting considered (future enhancement)

---

## AWS Deployment (Optional)

### Architecture

```
Route53 (DNS)
  ↓
CloudFront (CDN)
  ↓
ALB (Load Balancer)
  ↓
ECS Fargate (Next.js app, 2+ tasks)
  ↓
RDS PostgreSQL (Multi-AZ)
  ↓
S3 (backups)
```

### Quick Start (CloudFormation)

```bash
# Create VPC + RDS + ECS cluster
aws cloudformation create-stack \
  --stack-name thermal-monitor \
  --template-body file://infrastructure/cloudformation.yaml

# Deploy application
aws ecs update-service \
  --cluster thermal-monitor \
  --service app \
  --force-new-deployment
```

(Full CloudFormation template in `infrastructure/cloudformation.yaml` — not included in this guide)

---

## Troubleshooting

### PostgreSQL Connection Fails

```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Check credentials
psql -U thermal -h localhost -d thermal_monitor

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Reset password
sudo -u postgres psql
ALTER USER thermal WITH PASSWORD 'new_password';
```

### Application Won't Start

```bash
# Check systemd logs
sudo journalctl -u thermal-monitor -n 50

# Run manually (see errors)
cd /opt/thermal-monitor
npm start

# Check .env.local syntax
cat .env.local
```

### Database Slow Queries

```bash
# Enable slow query log (postgresql.conf)
log_min_duration_statement = 1000  # 1 second

# Analyze query plans
EXPLAIN ANALYZE SELECT ... FROM readings WHERE ...;

# Check composite index exists
\d readings  # In psql
```

### Email Notifications Not Sending

```bash
# Test SMTP connection
telnet $SMTP_HOST $SMTP_PORT

# Check .env.local
grep SMTP .env.local

# View application logs
sudo journalctl -u thermal-monitor | grep email

# Test with MailHog (dev)
docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

### High Memory Usage

```bash
# Check Node.js process
ps aux | grep node

# Monitor over time
watch -n 1 'ps aux | grep node'

# Increase memory limit in systemd
MemoryLimit=8G  # In thermal-monitor.service
```

### Disk Running Out

```bash
# Check disk usage
df -h

# Find large files
du -sh /var/lib/postgresql/*

# Archive old readings (manual SQL)
DELETE FROM readings
WHERE timestamp < NOW() - INTERVAL '90 days';
VACUUM readings;  # Reclaim disk space
```

---

## Backup & Recovery

### Manual Backup

```bash
# Full dump
pg_dump -U thermal -F c thermal_monitor > backup.dump

# Restore
pg_restore -U thermal -d thermal_monitor backup.dump
```

### Automated Backup (Cron)

```bash
# Backup at 2am daily
0 2 * * * pg_dump -U thermal thermal_monitor | gzip > /backups/thermal_$(date +\%Y\%m\%d).sql.gz

# Keep 7 days
find /backups -name "thermal_*.sql.gz" -mtime +7 -delete
```

### Disaster Recovery (RTO: 30min, RPO: 1 day)

```bash
# On new server:
sudo -u postgres createuser thermal -P
sudo -u postgres createdb -O thermal thermal_monitor

# Restore backup
pg_restore -U thermal -d thermal_monitor /backups/backup_20260228.dump

# Verify
psql -U thermal -d thermal_monitor -c "SELECT COUNT(*) FROM readings;"
```

---

## Performance Tuning

### PostgreSQL

Edit `/etc/postgresql/15/main/postgresql.conf`:

```ini
# Connection pooling
max_connections = 200
shared_buffers = 256MB  # 25% of RAM

# Query performance
effective_cache_size = 1GB  # 50% of RAM
work_mem = 16MB
maintenance_work_mem = 64MB

# Logging
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000

# Replication (future)
wal_level = replica
max_wal_senders = 3
```

Reload:

```bash
sudo systemctl reload postgresql
```

### Next.js

Edit `next.config.js`:

```javascript
module.exports = {
  compress: true,  // Enable gzip
  swcMinify: true,  // Faster build
  productionBrowserSourceMaps: false,  // Reduce bundle
  experimental: {
    optimizePackageImports: ["recharts"],  // Tree-shake charts
  },
};
```

### Nginx

Already optimized in reverse proxy config above.

---

## Monitoring & Observability

### Application Metrics

```bash
# CPU + Memory usage
top -p $(pgrep -f "npm start")

# Request count + latency (from Nginx logs)
tail -f /var/log/nginx/access.log | awk '{print $9}' | sort | uniq -c
```

### Database Metrics

```sql
-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Connection count
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Slow queries
SELECT query, calls, total_time, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

### Alerts

Set up alerts for:
- [ ] HTTP 5xx errors > 5 in 5 min
- [ ] Database connection errors
- [ ] Disk usage > 80%
- [ ] Memory usage > 90%
- [ ] Systemd service stopped

---

## Maintenance Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| Database backup | Daily | Cron |
| Security updates | Weekly | DevOps |
| SSL certificate renewal | 60 days before expiry | Certbot |
| Database vacuum | Weekly | Cron |
| Log rotation | Daily | logrotate |
| Performance review | Monthly | DevOps |
| Disaster recovery drill | Quarterly | DevOps |

---

## Cost Estimation (AWS)

| Resource | Size | Cost/Month |
|----------|------|-----------|
| ECS Fargate | 1 vCPU, 2GB RAM | $30 |
| RDS PostgreSQL | db.t3.medium | $50 |
| ALB | 1x | $16 |
| S3 backups | 10GB/month | $0.23 |
| Data transfer | 1TB/month | $0 (within region) |
| **Total** | — | **~$100** |

(Self-hosted on 2-core server: ~$30/month)

---

## Questions & Support

- [ ] Need help setting up PostgreSQL?
- [ ] SMTP configuration issues?
- [ ] Performance tuning questions?
- [ ] Backup/recovery procedures?

Contact: devops@example.com

---

## Unresolved Questions

- [ ] Should auto-scaling be enabled (v1.1)?
- [ ] Multi-region deployment strategy?
- [ ] Data residency requirements (GDPR, CCPA)?
- [ ] Compliance certifications needed (SOC2, ISO27001)?
