# 🏢 Amdox ERP — AI-Powered Cloud ERP Suite

**Project Code:** AMX-ERP-2026-04 | **Version:** 1.0.0 | **April 2026**

> Enterprise Resource Planning platform with AI-driven demand forecasting, multi-tenant authentication, finance management, HR & payroll, supply chain automation, and real-time dashboards.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start (Local Dev)](#quick-start-local-dev)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Running with Docker](#running-with-docker)
- [API Documentation](#api-documentation)
- [Deployment Guide](#deployment-guide)
- [Module Overview](#module-overview)
- [Default Credentials](#default-credentials)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
│          Next.js 15 + React 19 + TypeScript 5.5             │
│     Zustand (state) │ TanStack Query (server state)         │
│     Recharts (charts) │ Tailwind CSS 4 │ shadcn/ui          │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS REST + JWT
┌────────────────────────────▼────────────────────────────────┐
│                      API GATEWAY                            │
│         NestJS 11 │ Node.js 22 LTS │ TypeScript 5.5         │
│    JWT Auth │ RBAC Guards │ Tenant Isolation Middleware      │
│    Rate Limiting │ Helmet │ OpenAPI 3.1 │ Swagger UI        │
└──┬──────────┬──────────┬───────────┬──────────┬────────────┘
   │          │          │           │          │
   ▼          ▼          ▼           ▼          ▼
Finance     HR &      Supply      Notif.    Dashboard
Module    Payroll     Chain      Engine      Module
   │          │          │           │          │
└──┴──────────┴──────────┴───────────┴──────────┘
                         │
           ┌─────────────┼──────────────┐
           ▼             ▼              ▼
     PostgreSQL 17     Redis 8     Elasticsearch
     (Prisma ORM)    (Cache/Queue) (Full-text search)
           │
     TimescaleDB
    (Audit/Telemetry)

                    ML SERVICE (Python)
               FastAPI │ Prophet │ scikit-learn
                   Demand Forecasting API
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.5 |
| **UI** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **State** | Zustand + TanStack Query v5 |
| **Charts** | Recharts |
| **Backend** | NestJS 11, Node.js 22 LTS |
| **Database** | PostgreSQL 17 + Prisma ORM |
| **Cache** | Redis 8 + ioredis |
| **Queue** | BullMQ |
| **AI/ML** | Python 3.13, FastAPI, Prophet, scikit-learn |
| **Auth** | JWT (RS256), Passport.js, bcrypt |
| **DevOps** | Docker, Docker Compose, GitHub Actions |
| **Deployment** | Vercel (web), Railway/Fly.io (API), Supabase (DB) |

---

## 📁 Project Structure

```
amdox-erp/                          ← Turborepo monorepo root
├── apps/
│   ├── web/                        ← Next.js 15 frontend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── auth/login/     ← Login page
│   │       │   ├── dashboard/      ← Main dashboard + KPIs
│   │       │   ├── finance/        ← GL, invoices, payments
│   │       │   ├── hr/             ← Employees, leave, payroll
│   │       │   ├── supply-chain/   ← Inventory, vendors, POs
│   │       │   ├── notifications/  ← Notification centre
│   │       │   └── audit/          ← Audit log viewer
│   │       ├── components/
│   │       │   └── layout/         ← Sidebar + Header
│   │       ├── store/              ← Zustand auth store
│   │       └── lib/                ← API client + utils
│   │
│   ├── api/                        ← NestJS backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/           ← JWT, login, register
│   │       │   ├── finance/        ← GL, invoices, payments
│   │       │   ├── hr/             ← Employees, leave, payroll
│   │       │   ├── supply-chain/   ← Vendors, inventory, POs
│   │       │   ├── notifications/  ← Event-driven alerts
│   │       │   ├── audit/          ← Immutable audit log
│   │       │   └── dashboard/      ← KPI aggregation
│   │       ├── common/
│   │       │   ├── guards/         ← JWT + Roles guards
│   │       │   ├── interceptors/   ← Logging + Transform
│   │       │   ├── filters/        ← Global error handler
│   │       │   └── decorators/     ← @CurrentUser, @TenantId
│   │       └── config/             ← Prisma service/module
│   │
│   └── ml-service/                 ← Python FastAPI ML
│       ├── main.py                 ← Prophet forecasting API
│       └── requirements.txt
│
├── packages/
│   └── db/
│       └── prisma/
│           ├── schema.prisma       ← Complete DB schema
│           └── seed.ts             ← Demo data seeder
│
├── .github/workflows/ci-cd.yml    ← GitHub Actions pipeline
├── docker-compose.yml              ← Production stack
├── docker-compose.dev.yml          ← Dev databases only
├── turbo.json                      ← Turborepo config
└── .env.example                    ← Environment template
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 22 | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Docker | Latest | [docker.com](https://docker.com) |
| Python | ≥ 3.13 | [python.org](https://python.org) |

### Step 1 — Clone & Install

```bash
git clone https://github.com/your-username/amdox-erp.git
cd amdox-erp

# Install all workspace dependencies
pnpm install
```

### Step 2 — Environment Setup

```bash
# Copy the template
cp .env.example .env

# Edit .env with your values (defaults work for local dev)
nano .env
```

### Step 3 — Start Databases

```bash
# Start PostgreSQL + Redis in Docker
docker compose -f docker-compose.dev.yml up -d

# Verify they're running
docker compose -f docker-compose.dev.yml ps
```

### Step 4 — Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed demo data (creates users, accounts, employees, products)
pnpm db:seed
```

### Step 5 — Start Dev Servers

```bash
# Start everything with Turborepo (hot-reload)
pnpm dev

# Or start individually:
pnpm --filter @amdox/api dev       # API on :3001
pnpm --filter @amdox/web dev       # Web on :3000
```

### Step 6 — Start ML Service (optional)

```bash
cd apps/ml-service
pip install -r requirements.txt
python main.py
# ML service on :8000
```

### ✅ Access the App

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **API** | http://localhost:3001 |
| **Swagger Docs** | http://localhost:3001/api-docs |
| **ML Service** | http://localhost:8000/docs |
| **DB Admin** | http://localhost:8080 |
| **Prisma Studio** | `pnpm db:studio` → http://localhost:5555 |

---

## 🗄️ Database Setup

The Prisma schema covers all modules:

```
Tenant → User → (Finance: Account, JournalEntry, Invoice, Payment)
                (HR: Department, Employee, LeaveRequest, Attendance, PayrollRun)
                (Supply: Vendor, Product, InventoryItem, PurchaseOrder)
                (System: Notification, AuditLog, ForecastData)
```

```bash
# Generate client after schema changes
pnpm db:generate

# Create migration (dev)
pnpm db:migrate

# Apply to production
cd packages/db && npx prisma migrate deploy

# Open Prisma Studio (visual DB editor)
pnpm db:studio

# Re-seed (resets demo data)
pnpm db:seed
```

---

## 🔐 Environment Variables

Key variables to configure (copy `.env.example` → `.env`):

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/amdox_erp"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT (CHANGE THESE IN PRODUCTION!)
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"

# ML Service
ML_SERVICE_URL="http://localhost:8000"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## 🐳 Running with Docker

### Full production stack (all services):

```bash
# Build and start everything
docker compose up -d --build

# View logs
docker compose logs -f api
docker compose logs -f web

# Stop everything
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v
```

### With DB Admin tool:

```bash
docker compose --profile tools up -d
# Adminer at http://localhost:8080
# Server: postgres | User: postgres | Password: postgres | DB: amdox_erp
```

---

## 📚 API Documentation

Interactive Swagger UI is available at **http://localhost:3001/api-docs**

### Key Endpoints

```
POST   /api/v1/auth/login              Login
POST   /api/v1/auth/register           Register
GET    /api/v1/auth/me                 Current user profile

GET    /api/v1/dashboard/kpis          All KPI metrics
GET    /api/v1/dashboard/recent-activity

GET    /api/v1/finance/summary         Financial overview
GET    /api/v1/finance/invoices        List invoices
POST   /api/v1/finance/invoices        Create invoice
POST   /api/v1/finance/journal-entries Double-entry booking
GET    /api/v1/finance/accounts        Chart of accounts

GET    /api/v1/hr/employees            List employees
POST   /api/v1/hr/employees            Add employee
GET    /api/v1/hr/leave-requests       Leave requests
POST   /api/v1/hr/payroll/run          Process payroll

GET    /api/v1/supply-chain/inventory  Stock levels
GET    /api/v1/supply-chain/vendors    Vendor list
POST   /api/v1/supply-chain/purchase-orders  Create PO
PATCH  /api/v1/supply-chain/purchase-orders/:id/status

GET    /api/v1/notifications           User notifications
PATCH  /api/v1/notifications/read-all  Mark all read

GET    /api/v1/audit/logs              Audit trail

# ML Service
POST   http://localhost:8000/forecast  Demand forecast
GET    http://localhost:8000/health    ML health check
```

---

## ☁️ Deployment Guide

### Option A — Railway (Easiest, free tier available)

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login

# Deploy API
railway init --name amdox-api
railway add postgresql redis
railway up --service api

# Deploy frontend
railway init --name amdox-web
railway up --service web
```

### Option B — Vercel + Railway (Recommended)

**Frontend → Vercel:**
```bash
cd apps/web
npx vercel --prod
# Set env vars in Vercel dashboard
```

**API → Railway:**
```bash
cd apps/api
railway up
# Set DATABASE_URL, REDIS_URL, JWT_SECRET in Railway dashboard
```

**Database → Supabase (free PostgreSQL):**
1. Create project at [supabase.com](https://supabase.com)
2. Copy the connection string
3. Set `DATABASE_URL` in Railway

### Option C — Docker on VPS

```bash
# On your server
git clone https://github.com/your-username/amdox-erp.git
cd amdox-erp
cp .env.example .env
# Edit .env with production values

docker compose up -d --build
# Add Nginx reverse proxy + Let's Encrypt SSL
```

### Post-Deployment Checklist

```bash
# Run migrations on production DB
DATABASE_URL="your-prod-url" npx prisma migrate deploy

# Seed initial data (first deploy only)
DATABASE_URL="your-prod-url" npx ts-node packages/db/prisma/seed.ts

# Verify health
curl https://your-api-domain.com/api/v1/health
```

---

## 📦 Module Overview

### 🔐 Auth Module
- JWT access + refresh token rotation
- bcrypt password hashing (12 rounds)
- Role-Based Access Control: `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `ACCOUNTANT`, `HR_MANAGER`, `SUPPLY_CHAIN_MANAGER`, `VIEWER`
- Multi-tenant isolation — every query is scoped by `tenantId`

### 💰 Finance Module
- **Chart of Accounts** — hierarchical GL accounts (Asset, Liability, Equity, Revenue, Expense)
- **Journal Entries** — double-entry validation (debits must equal credits)
- **Invoices (AR)** — customer invoicing with line items, tax, discounts
- **Bills (AP)** — vendor bills and payment tracking
- **Payments** — partial and full payment recording
- **Financial Reports** — 6-month revenue vs expense trend

### 👥 HR & Payroll Module
- **Employee Management** — full employee lifecycle, org hierarchy
- **Department Structure** — recursive org chart with manager assignment
- **Leave Management** — multi-type leave requests with approval workflow
- **Payroll Processing** — gross-to-net calculation with tax deductions, BullMQ async jobs
- **Audit Trail** — every payroll mutation recorded

### 📦 Supply Chain Module
- **Vendor Management** — vendor master data, payment terms
- **Product Catalog** — SKU management, pricing, categories
- **Inventory** — real-time stock levels with reorder point alerts
- **Purchase Orders** — full PO lifecycle (Draft → Sent → Confirmed → Received)
- **Auto Reorder** — events emitted when stock hits reorder point

### 🔔 Notifications Module
- Event-driven via NestJS EventEmitter2
- In-app notification center with unread badge
- Auto-notifications for: new invoices, leave requests, low stock, payroll completion
- Mark read / mark all read

### 📋 Audit Module
- Immutable append-only log of all system mutations
- Filterable by resource, action, user, date
- SOC 2 Type II aligned
- Paginated with 50 records per page

### 🤖 AI Forecasting (ML Service)
- Prophet time-series model for 90-day SKU demand prediction
- Fallback weighted moving average model if Prophet unavailable
- Confidence intervals and MAPE score
- REST API: `POST /forecast` with historical data

---

## 👤 Default Credentials

After running `pnpm db:seed`:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@amdox.com | Admin@123 |
| Accountant | finance@amdox.com | Admin@123 |
| HR Manager | hr@amdox.com | Admin@123 |
| Supply Chain | supply@amdox.com | Admin@123 |
| Manager | manager@amdox.com | Admin@123 |

> ⚠️ **Change all passwords immediately in production!**

---

## 📊 Non-Functional Requirements

| Requirement | Target | How |
|-------------|--------|-----|
| Availability | 99.9% uptime | Docker health checks, Railway auto-restart |
| API Latency | < 300ms P95 | Redis caching, Prisma query optimization |
| Throughput | 2,000 concurrent users | Horizontal scaling via Docker replicas |
| Security | OWASP Top 10 | Helmet, rate limiting, input validation |
| Data Backup | RPO < 15 min | Supabase/RDS automated backups |

---

## 🧑‍💻 Development Commands

```bash
pnpm dev              # Start all services in watch mode
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm test             # Run all tests
pnpm db:generate      # Regenerate Prisma client
pnpm db:push          # Push schema changes (dev)
pnpm db:migrate       # Create migration file
pnpm db:seed          # Seed demo data
pnpm db:studio        # Open Prisma Studio GUI
```

---

## 📄 Submission

**Naming convention:** `YourName_AMX_ERP_AmdoxTechnologies_April2026.zip`

**Deliverables:**
- [x] Project Report (PDF) — `AMX-ERP-2026-04`
- [x] GitHub Repository — this repo
- [x] README.md — this file
- [ ] Live Demo URL — deploy and add here
- [ ] Demo Video — 5–7 min walkthrough on Loom/YouTube

---

*Built with precision and modern engineering principles*
*Amdox Technologies • Engineering Division • April 2026*
