---
phase: 7
title: "Settings & Notifications"
status: pending
priority: P2
effort: 5h
depends_on: [6]
---

# Phase 7 — Settings & Notifications

## Context Links
- [Plan Overview](./plan.md)
- [Phase 6 — Threshold & Alert System](./phase-06-threshold-alerts.md)
- Nodemailer: https://nodemailer.com/about/
- shadcn/ui Form: https://ui.shadcn.com/docs/components/form

## Overview
Build the settings page for managing temperature thresholds, gap thresholds, and email notification configuration. Includes forms for CRUD operations, Nodemailer setup, and test email functionality.

## Requirements

### Functional
- **Temperature threshold management**:
  - List all thresholds (table with edit/delete)
  - Create new threshold (form dialog)
  - Edit existing threshold
  - Toggle active/inactive
  - Fields: name, camera (dropdown or "All Cameras"), min celsius, max celsius, cooldown minutes, notify email, notify UI
- **Gap threshold management**:
  - Same CRUD pattern as temperature thresholds
  - Fields: camera, interval (5/10/15 min), max gap celsius, direction (rise/drop/both), cooldown, notify flags
- **Email configuration**:
  - SMTP settings: host, port, user, password, from address
  - Alert recipient email(s)
  - Test email button (sends test email to verify config)
  - Status indicator: configured/not configured
- **Settings page layout**: tabbed interface (Temperature | Gap | Email)

### Non-Functional
- Form validation with clear error messages
- Optimistic UI updates on toggle (instant feedback)
- SMTP password masked in UI (shown as dots)
- Email config stored server-side (env vars or JSON file, not in DB)

## Architecture

### Settings Page Layout
```
settings/page.tsx
├── Tabs (shadcn Tabs component)
│   ├── Tab: Temperature Thresholds
│   │   ├── threshold-list.tsx (table)
│   │   └── temperature-threshold-form.tsx (dialog)
│   ├── Tab: Gap Thresholds
│   │   ├── gap-threshold-list.tsx (table)
│   │   └── gap-threshold-form.tsx (dialog)
│   └── Tab: Email Configuration
│       └── email-config-form.tsx
```

### Email Config Storage
- Store in `data/email-config.json` (gitignored)
- Fallback to environment variables (`SMTP_*`)
- Service reads file first, then env vars
- API endpoint for CRUD: `GET/PUT /api/settings/email`

```json
// data/email-config.json
{
  "smtp": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "user": "alerts@company.com",
    "pass": "encrypted-or-plain"
  },
  "from": "Thermal Monitor <alerts@company.com>",
  "recipients": ["ops@company.com", "manager@company.com"]
}
```

### Email Service Detail (`src/services/email-service.ts`)
```typescript
class EmailService {
  private transporter: Transporter | null = null;

  async initialize(): Promise<void>        // Create Nodemailer transporter
  async sendAlertEmail(alert: Alert): Promise<boolean>
  async sendTestEmail(): Promise<boolean>
  async getConfig(): Promise<EmailConfig>
  async updateConfig(config: EmailConfig): Promise<void>
  isConfigured(): boolean
}
```

### Alert Email Template
```
Subject: [THERMAL ALERT] {camera_name} - {alert_type}

Camera: {camera_name} ({camera_id})
Location: {location}
Type: {Temperature Threshold | Gap Detection}
Value: {reading_celsius}C ({reading_fahrenheit}F)
Threshold: {threshold_name} (max: {max}C)
Time: {triggered_at formatted}

---
Thermal Camera Monitoring System
```

## Related Code Files

### Create
- `src/app/settings/page.tsx` — settings page with tabs
- `src/components/settings/temperature-threshold-list.tsx` — threshold table
- `src/components/settings/temperature-threshold-form.tsx` — create/edit form
- `src/components/settings/gap-threshold-list.tsx` — gap threshold table
- `src/components/settings/gap-threshold-form.tsx` — create/edit gap form
- `src/components/settings/email-config-form.tsx` — email settings form
- `data/.gitkeep` — data directory for email config
- Email alert template (inline in email-service, no separate file needed)

### Modify
- `src/services/email-service.ts` — full implementation
- `.gitignore` — add `data/email-config.json`
- `.env.example` — document SMTP env vars

## Implementation Steps

1. **Implement email service fully** (`src/services/email-service.ts`)
   - `getConfig()`: read from `data/email-config.json`, fallback to env vars
   - `updateConfig(config)`: write to `data/email-config.json`, re-initialize transporter
   - `initialize()`: create Nodemailer transporter from config
   - `sendAlertEmail(alert)`: format email body (plain text + simple HTML), send
   - `sendTestEmail()`: send test message, return success/failure
   - `isConfigured()`: check if transporter exists and config is valid
   - All methods catch errors gracefully, return boolean success

2. **Create email API route** (`src/app/api/settings/email/route.ts`)
   - GET: return config (password masked as `"****"`)
   - PUT: update config (if password is `"****"`, keep existing)
   - POST (test): send test email, return result

3. **Create temperature threshold list** (`src/components/settings/temperature-threshold-list.tsx`)
   - Fetch thresholds from `GET /api/thresholds/temperature`
   - Table columns: name, camera, min, max, cooldown, email, UI, active, actions
   - Active toggle: PATCH-style PUT with optimistic update
   - Edit button: open form dialog pre-filled
   - Delete button: confirm dialog then DELETE

4. **Create temperature threshold form** (`src/components/settings/temperature-threshold-form.tsx`)
   - Dialog/sheet with form
   - Fields:
     - Name (text, required)
     - Camera (select: "All Cameras" or specific camera, fetch camera list)
     - Min Celsius (number, optional)
     - Max Celsius (number, optional)
     - Cooldown Minutes (number, default 15, min 1)
     - Notify Email (switch)
     - Notify UI (switch)
   - Validation: at least one of min/max required
   - Submit: POST (create) or PUT (edit) to /api/thresholds/temperature
   - On success: close dialog, refresh list

5. **Create gap threshold list** (`src/components/settings/gap-threshold-list.tsx`)
   - Same pattern as temperature threshold list
   - Columns: camera, interval, max gap, direction, cooldown, email, UI, active, actions

6. **Create gap threshold form** (`src/components/settings/gap-threshold-form.tsx`)
   - Fields:
     - Camera (select: "All Cameras" or specific)
     - Interval (select: 5, 10, or 15 minutes)
     - Max Gap Celsius (number, required)
     - Direction (select: Rise, Drop, Both)
     - Cooldown Minutes (number, default 15)
     - Notify Email (switch)
     - Notify UI (switch)

7. **Create email config form** (`src/components/settings/email-config-form.tsx`)
   - Fields:
     - SMTP Host (text)
     - SMTP Port (number, default 587)
     - SMTP User (text)
     - SMTP Password (password input, masked)
     - From Address (text)
     - Recipients (text, comma-separated)
   - Status indicator: green "Configured" / red "Not Configured"
   - Test Email button: calls POST, shows result toast
   - Save button: calls PUT

8. **Implement settings page** (`src/app/settings/page.tsx`)
   - Client component
   - shadcn `<Tabs>` with 3 tabs
   - Default to Temperature tab
   - Each tab lazy-loads its content

9. **Add data directory** and update `.gitignore`
   - Create `data/.gitkeep`
   - Add `data/email-config.json` to `.gitignore`

10. **Test full flow**
    - Create threshold via settings UI
    - Run live seeder
    - Verify alert fires when threshold breached
    - Verify email sends (if SMTP configured)
    - Verify toast appears in UI
    - Acknowledge alert from alerts page

## Todo List
- [ ] Implement email service (config read/write, send, test)
- [ ] Create email API route
- [ ] Create temperature threshold list component
- [ ] Create temperature threshold form dialog
- [ ] Create gap threshold list component
- [ ] Create gap threshold form dialog
- [ ] Create email config form
- [ ] Implement settings page with tabs
- [ ] Add data directory + gitignore
- [ ] Test threshold CRUD via UI
- [ ] Test email config + test email
- [ ] Test end-to-end: threshold → alert → email + toast
- [ ] Verify cache invalidation after threshold changes

## Success Criteria
- Settings page renders with 3 functional tabs
- Temperature thresholds: create, edit, delete, toggle active all work
- Gap thresholds: same CRUD functionality
- Email config: save, load (masked password), test email button works
- End-to-end: create threshold → ingest reading that breaches → alert created → email sent → toast shown
- Form validation prevents invalid input
- Optimistic UI on toggle (instant visual feedback)

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| SMTP password stored in plain text | Medium | Acceptable for local deploy; document risk, suggest env vars for production |
| Email config file permissions | Low | Document: ensure file readable only by app user |
| Form validation edge cases | Low | Server-side validation as safety net |
| Threshold cache not invalidated | Medium | Explicit invalidation + 60s TTL |
| Too many SMTP connections | Low | Reuse transporter, pool connections |

## Unresolved Questions
- Should email config support multiple SMTP servers or just one? (Recommend: just one for KISS)
- Should there be a "mute all alerts" global toggle? (Recommend: defer, YAGNI)
