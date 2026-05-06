# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This?

LLM gateway/proxy (Go + Next.js) that manages multiple AI providers with routing, failover, pricing, and an admin dashboard. Single binary deployment — frontend is embedded into the Go binary.

## Architecture

```
main.go → cmd/ (Cobra CLI) → internal/server/ (Gin HTTP)
                                   ↓
                              internal/relay/     ← LLM proxy engine
                              internal/transformer/ ← provider adapters
                              internal/db/         ← GORM (SQLite/MySQL/Postgres)
                              internal/conf/       ← Viper config
```

## Key Packages

| Package | Purpose |
|---------|---------|
| `internal/server/router` | Route definitions, grouped by domain |
| `internal/relay/balancer` | Channel load balancing + circuit breaker |
| `internal/transformer/inbound` | Ingest requests from any LLM format |
| `internal/transformer/outbound` | Send requests to specific providers |
| `internal/db` | 17+ tables, auto-migration, versioned migration files |
| `internal/price` | Auto-generated pricing data (from Python script) |

## Non-Obvious Gotchas

1. **Frontend embed order matters**: `web/` must build → move `web/out` to `static/` → then `go build`. The Go binary serves `static/` as embedded FS.
2. **Statistics are buffered in memory**: Stats are batch-written periodically — graceful shutdown is critical to avoid data loss.
3. **Relay routing is complex**: Channels → Keys → Groups → Models chain. Understanding this before modifying routing logic is critical.
4. **Price data is code-generated**: Don't edit `internal/price/` files manually — they're generated from `scripts/updatePrice.py`.

## Dev Commands

```bash
# Backend only
go run main.go start

# Frontend dev (separate terminal, needs backend running)
cd web && pnpm install && NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8080" pnpm run dev

# Full build (frontend + backend)
cd web && pnpm install && pnpm run build && cd ..
mv web/out static/
go build -o octopus main.go

# Production build (cross-platform)
./scripts/build.sh release

# Tests
go test ./...
```

## Configuration

- Config via Viper with `OCTOPUS_` env var prefix (e.g. `OCTOPUS_PORT=8080`)
- Database: SQLite (default), MySQL, PostgreSQL
- Versioned migration files in `internal/db/migrate/`

## Tech Stack

- **Backend**: Go 1.24.4, Gin, GORM, Cobra, Viper, Zap logger
- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, Zustand, TanStack Query, Radix UI
- **Auth**: JWT (`golang-jwt/jwt/v5`)

## API Routes

- `/api/v1/user/*` — Auth (login, password, status)
- `/api/v1/channel/*` — Channel CRUD + sync + model fetch
- `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/embeddings` — LLM relay endpoints
