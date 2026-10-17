# Placement OS

Placement OS is an open-architecture engineering career operating system. The current production scope delivers **YouTube Guided Learning** — an end-to-end video and playlist learning platform with structured progress tracking, playlist continuity, timestamped note taking, and dashboard resume capabilities.

---

## Architecture Overview

Placement OS is organized as a monorepo:

- **`apps/web/`**: Next.js 16 (Turbopack), React 19, TypeScript, Tailwind CSS v4, Lucide icons.
- **`backend/`**: FastAPI (Python 3.12+), SQLAlchemy (asyncpg), Alembic, Pydantic v2.
- **Database**: PostgreSQL 16+ (Local Docker container or hosted Neon serverless).

```
Placement-OS/
├── apps/
│   └── web/                   # Next.js frontend application
│       ├── e2e/               # Playwright browser end-to-end tests
│       └── src/               # Application routes, components, and hooks
├── backend/                   # FastAPI backend service
│   ├── alembic/               # Database migrations (11 linear revisions)
│   ├── app/                   # API routes, models, schemas, and services
│   └── tests/                 # Pytest test suite (172 tests)
├── docker/                    # Docker container configuration & init scripts
├── docker-compose.yml         # Local PostgreSQL development setup
├── render.yaml                # Render Blueprint for zero-cost backend hosting
└── package.json               # Monorepo workspace configuration (pnpm)
```

---

## Local Development Setup

### 1. Prerequisites
- Node.js 20+ and `pnpm` (v9 or v10)
- Python 3.12+
- Docker (for PostgreSQL database)

### 2. Database Setup
Start the local PostgreSQL container (runs on port `5434` to prevent port collisions):
```bash
docker compose up -d
```

### 3. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and supply your local secrets and YOUTUBE_API_KEY

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload --port 8000
```
Backend API will be available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### 4. Frontend Setup
```bash
# In project root or apps/web
pnpm install

# Configure environment variables
cp apps/web/.env.example apps/web/.env.local

# Start Next.js development server
pnpm --filter web dev
```
Frontend will be available at `http://localhost:3000`.

---

## Verification & Testing

### Backend Test Suite
```bash
cd backend
.venv/bin/pytest tests/ -q
# 172 tests passed
```

### Frontend Checks
```bash
# ESLint
CI=1 npm run lint --prefix apps/web

# TypeScript Typecheck
npm run typecheck --prefix apps/web

# Production Build
npm run build --prefix apps/web
```

### Playwright Browser E2E Tests
```bash
pnpm --filter web test:e2e
# 8 critical student journeys verified
```

---

## Zero-Cost MVP Deployment Architecture (₹0 / Month)

Placement OS is designed to deploy on verified zero-cost hosting tiers:

| Tier / Component | Recommended Provider | Monthly Cost | Specifications & Limits |
| :--- | :--- | :---: | :--- |
| **Frontend** | **Vercel (Hobby Tier)** | **₹0 ($0)** | 100 GB bandwidth, automatic SSL, native Next.js Turbopack |
| **Backend** | **Render (Free Web Service)** | **₹0 ($0)** | 512 MB RAM, 0.1 CPU, auto-sleep after 15m idle (~50s cold start) |
| **Database** | **Neon (Free Serverless Postgres)** | **₹0 ($0)** | 0.5 GB storage, built-in connection pooling, instant branching |
| **Domain** | **Provider Subdomains** | **₹0 ($0)** | `*.vercel.app` and `*.onrender.com` with free TLS/HTTPS |

*Total Monthly Cost: ₹0 / $0.*

For deployment runbooks and configuration details, see the repository deployment guides and `render.yaml`.
