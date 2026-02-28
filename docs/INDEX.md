# Documentation Index

Quick navigation guide to all Thermal Monitor documentation.

---

## Start Here

**First time?** Read in this order:

1. **[README.md](../README.md)** (5 min) — What is this project? Quick start setup.
2. **[project-overview-pdr.md](./project-overview-pdr.md)** (10 min) — Vision, requirements, scope.
3. **[codebase-summary.md](./codebase-summary.md)** (20 min) — How the code is organized.

---

## By Role

### Frontend Developer
- [codebase-summary.md](./codebase-summary.md#components) — Component structure
- [code-standards.md](./code-standards.md#react--component-standards) — React patterns + hooks
- [system-architecture.md](./system-architecture.md#component-hierarchy) — Component relationships

### Backend Developer
- [codebase-summary.md](./codebase-summary.md#services-8-modules) — Service layer
- [codebase-summary.md](./codebase-summary.md#api-routes-14-endpoints) — API endpoints
- [code-standards.md](./code-standards.md#database--service-standards) — DB + service patterns
- [system-architecture.md](./system-architecture.md#data-flow--reading-ingestion--alert-evaluation) — Alert evaluation

### DevOps / Operations
- [deployment-guide.md](./deployment-guide.md) — Setup, production, troubleshooting
- [system-architecture.md](./system-architecture.md#monitoring--observability) — Monitoring
- [system-architecture.md](./system-architecture.md#disaster-recovery) — Backup + recovery

### Product Manager / Tech Lead
- [project-overview-pdr.md](./project-overview-pdr.md) — Requirements + vision
- [project-roadmap.md](./project-roadmap.md) — Timeline, phases, backlog
- [system-architecture.md](./system-architecture.md#high-level-architecture) — Architecture overview

### Architect
- [system-architecture.md](./system-architecture.md) — Full architecture guide
- [code-standards.md](./code-standards.md) — Patterns + conventions
- [codebase-summary.md](./codebase-summary.md#key-patterns) — Key patterns used

---

## By Topic

### Getting Started & Setup
- [README.md](../README.md#quick-start) — Local development setup
- [deployment-guide.md](./deployment-guide.md#development-environment-setup) — Dev environment
- [deployment-guide.md](./deployment-guide.md#local-testing-with-docker-compose) — Docker Compose

### Architecture & Design
- [system-architecture.md](./system-architecture.md#high-level-architecture) — System diagram
- [system-architecture.md](./system-architecture.md#data-flow--polling-5s-cycle) — Polling flow
- [system-architecture.md](./system-architecture.md#data-flow--reading-ingestion--alert-evaluation) — Alert evaluation
- [system-architecture.md](./system-architecture.md#database-schema) — Database schema + SQL

### Code & Patterns
- [code-standards.md](./code-standards.md) — All coding standards
- [codebase-summary.md](./codebase-summary.md) — Code organization guide
- [code-standards.md](./code-standards.md#code-review-checklist) — Review checklist

### API Reference
- [codebase-summary.md](./codebase-summary.md#api-routes-14-endpoints) — API endpoints
- [README.md](../README.md#api-overview) — API overview table
- [codebase-summary.md](./codebase-summary.md#services-8-modules) — Service functions

### Database
- [system-architecture.md](./system-architecture.md#database-schema) — Schema + indexes
- [codebase-summary.md](./codebase-summary.md#database-schema-6-models) — Model descriptions
- [deployment-guide.md](./deployment-guide.md#backup--recovery) — Backup procedures

### Deployment & Operations
- [deployment-guide.md](./deployment-guide.md) — Complete deployment guide
- [README.md](../README.md#deployment) — Quick deployment reference
- [project-roadmap.md](./project-roadmap.md#unresolved-questions) — Deployment questions

### Performance & Scaling
- [system-architecture.md](./system-architecture.md#scalability-considerations) — Scaling path
- [code-standards.md](./code-standards.md#performance-considerations) — Performance patterns
- [codebase-summary.md](./codebase-summary.md#performance-baselines) — Baselines

### Testing
- [code-standards.md](./code-standards.md#testing-standards) — Test structure + coverage
- [code-standards.md](./code-standards.md#code-review-checklist) — QA checklist
- [project-roadmap.md](./project-roadmap.md#v020-completion-criteria) — Testing criteria

### Security
- [system-architecture.md](./system-architecture.md#security-considerations) — Security overview
- [code-standards.md](./code-standards.md#dependencies--imports) — Secure imports
- [deployment-guide.md](./deployment-guide.md#security-hardening) — Hardening

### Project Management
- [project-overview-pdr.md](./project-overview-pdr.md) — Requirements + vision
- [project-roadmap.md](./project-roadmap.md) — Phases + timeline
- [project-overview-pdr.md](./project-overview-pdr.md#success-metrics) — Success metrics

---

## Quick Lookup

### "How do I...?"

**...set up a dev environment?**
→ [README.md Quick Start](../README.md#quick-start) or [deployment-guide.md Dev Setup](./deployment-guide.md#development-environment-setup)

**...understand the API?**
→ [codebase-summary.md API Routes](./codebase-summary.md#api-routes-14-endpoints)

**...deploy to production?**
→ [deployment-guide.md Production](./deployment-guide.md#production-deployment-self-hosted)

**...write a new component?**
→ [code-standards.md React](./code-standards.md#react--component-standards)

**...add a new service?**
→ [code-standards.md Services](./code-standards.md#database--service-standards)

**...understand the architecture?**
→ [system-architecture.md](./system-architecture.md#high-level-architecture)

**...contribute code?**
→ [code-standards.md](./code-standards.md) + [Git Standards](./code-standards.md#git--commit-standards)

**...find a bug?**
→ [system-architecture.md Error Handling](./system-architecture.md#error-handling)

**...check what's next?**
→ [project-roadmap.md](./project-roadmap.md#phase-details--progress)

**...understand the database?**
→ [system-architecture.md Schema](./system-architecture.md#database-schema)

---

## File Sizes & Reading Time

| Document | Lines | Size | Read Time |
|----------|-------|------|-----------|
| [README.md](../README.md) | 176 | 5.2K | 5 min |
| [project-overview-pdr.md](./project-overview-pdr.md) | 234 | 8.0K | 10 min |
| [codebase-summary.md](./codebase-summary.md) | 518 | 20K | 20 min |
| [code-standards.md](./code-standards.md) | 817 | 20K | 30 min |
| [system-architecture.md](./system-architecture.md) | 699 | 26K | 30 min |
| [project-roadmap.md](./project-roadmap.md) | 453 | 13K | 15 min |
| [deployment-guide.md](./deployment-guide.md) | 795 | 16K | 45 min |

**Total:** 3,516 lines | 108K | ~2.5 hours to read all

---

## Search Tips

### GitHub Search
Use GitHub's search (`?` key) to find content across all docs:
- Search for API endpoint: `GET /api/readings`
- Search for service: `alert-evaluation-service`
- Search for component: `CameraCard`
- Search for pattern: `useEffect`

### Command Line
```bash
# Find all mentions of a term
grep -r "threshold" docs/

# Find files containing term
grep -l "Prisma" docs/*.md

# Search in README
grep -i "quick start" README.md
```

### Browser (GitHub)
- Use `Ctrl+F` to search within a document
- Use `Cmd+F` on macOS
- Use GitHub's code search for implementation files

---

## Document Cross-References

**README.md** references:
- project-overview-pdr.md (scope, requirements)
- codebase-summary.md (file structure)
- code-standards.md (patterns)
- system-architecture.md (architecture)
- deployment-guide.md (production)

**project-overview-pdr.md** references:
- code-standards.md (coding standards)
- system-architecture.md (technical architecture)

**codebase-summary.md** references:
- project-overview-pdr.md (requirements)
- code-standards.md (naming, patterns)

**code-standards.md** references:
- project-overview-pdr.md (scope, requirements)

**system-architecture.md** references:
- codebase-summary.md (services, components)
- code-standards.md (patterns, error handling)

**project-roadmap.md** references:
- project-overview-pdr.md (current status)

**deployment-guide.md** references:
- README.md (quick start)
- code-standards.md (environment setup)

---

## Maintenance & Updates

**See:** [deployment-guide.md Maintenance Schedule](./deployment-guide.md#maintenance-schedule)

| Task | Frequency | Owner |
|------|-----------|-------|
| Update roadmap | Per phase | PM |
| Sync codebase summary | Per feature | Tech Lead |
| Update standards | Per pattern | Tech Lead |
| Review all docs | Quarterly | Tech Lead |

---

## Unresolved Questions

Across all documentation, 29 unresolved questions have been identified and documented:

- [ ] Data retention policy (30 days vs 1 year)?
- [ ] Email notification mandatory or optional?
- [ ] WebSocket upgrade path priority?
- [ ] Multi-region deployment timeline?

See [project-overview-pdr.md Unresolved Questions](./project-overview-pdr.md#unresolved-questions) for full list.

---

## Version Info

- **Documentation Version:** 1.0.0
- **Generated:** 2026-02-27
- **Project Version:** 0.1.0 (Phases 1-3 complete)
- **Next Phase:** Phase 4 (Dashboard)

---

## Document Ownership

| Document | Owner | Last Updated | SLA |
|----------|-------|--------------|-----|
| README.md | Tech Lead | 2026-02-27 | Week |
| project-overview-pdr.md | PM | 2026-02-27 | Quarterly |
| codebase-summary.md | Tech Lead | 2026-02-27 | Per-feature |
| code-standards.md | Tech Lead | 2026-02-27 | Per-pattern |
| system-architecture.md | Architect | 2026-02-27 | Per-refactor |
| project-roadmap.md | PM | 2026-02-27 | Per-sprint |
| deployment-guide.md | DevOps | 2026-02-27 | Per-deploy |

---

## How to Contribute to Docs

1. **Identify gap:** Found missing info? Create issue with `[docs]` tag
2. **Update:** Edit relevant .md file, follow formatting conventions
3. **Review:** Have tech lead review changes
4. **Commit:** `git commit -m "docs: add X to Y"`
5. **Sync:** Update INDEX.md if structure changes

**Standard:** Keep docs within 800 LOC per file (split if needed)

---

## Need Help?

- **Setup issues:** See README.md + deployment-guide.md
- **Code questions:** See code-standards.md + codebase-summary.md
- **Architecture questions:** See system-architecture.md
- **Project questions:** See project-overview-pdr.md + project-roadmap.md
- **Operations questions:** See deployment-guide.md

---

**Last generated:** 2026-02-27 07:09 UTC
