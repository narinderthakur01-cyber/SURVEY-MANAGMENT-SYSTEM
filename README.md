# Survey Management & Live Field Workforce Tracking System

A production-grade platform for dynamic survey creation, field workforce task assignment, consent-based live GPS telemetry tracking, and comprehensive response collection & auditing.

---

## System Architecture & Features

### Core Modules
1. **Database & Identity Foundation (Phase 1):**
   - PostgreSQL 18 connection with SQLAlchemy 2.0 ORM.
   - Alembic database migration management.
   - Argon2id password hashing and cryptographic token derivation.
   - JWT access tokens with rotating, single-use refresh token families and automatic reuse revocation.
   - Strict Role-Based Access Control (`ADMIN`, `SUPERVISOR`, `WORKER`).

2. **Frontend Foundation & Authentication (Phase 2):**
   - React 18 + Vite + TypeScript single-page application.
   - Zustand persistent authentication state with automated token refresh.
   - Protected client-side routes and role-specific dashboard workspaces.

3. **Survey Engine & Dynamic Builder (Phase 3):**
   - Survey creation, versioning tree (`surveys -> survey_versions -> survey_sections -> questions -> question_options`).
   - 12 comprehensive question types (Short Text, Long Text, Number, Single Choice, Multiple Choice, Dropdown, Rating, Date, Yes/No, Image Upload, File Upload, GPS Capture).
   - Immutable version locks once published, protecting collected data integrity.
   - Public respondent runner (`/s/:slug`) with secure link generation.

4. **Workforce Task Management & Worker Portal (Phase 4):**
   - Field task creation, priority assignment, and team allocation.
   - Task assignment lifecycle (`ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED / REJECTED / CANCELLED`).
   - Field assistance requests and blocker issue reporting.
   - Full lifecycle audit trail with timestamp tracking.

5. **Live Field Workforce Tracking & Geolocation (Phase 5):**
   - Explicit worker location-sharing consent agreement with legal and privacy disclosures.
   - Real-time GPS coordinate telemetry with boundary validation and throttling.
   - OpenStreetMap / Leaflet interactive live tracking map with pulsing markers.
   - Stale location detection (>5 min) and configurable 30-day retention pruning.
   - Automatic session termination upon task completion or cancellation.

---

## Getting Started

### 1. Prerequisites
- **Python:** 3.11+ (Python 3.13 tested)
- **Node.js:** 18+ (Node.js 20+ recommended) & npm
- **Database:** PostgreSQL 16+ (PostgreSQL 18 tested)

### 2. Environment Configuration
Create a `.env` file in the project root:
```ini
# Database Connection (PostgreSQL)
DATABASE_URL=postgresql+psycopg2://survey_app:your_password@localhost:5432/survey_management

# Security & Cryptography (min 32 characters)
SECRET_KEY=c0a8f8d94e2b1748291047586a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Bootstrap Administrator
FIRST_SUPERUSER_EMAIL=admin@survey.org
FIRST_SUPERUSER_PASSWORD=ChangeThisPassword123!

# Tracking & Retention Settings
LOCATION_RETENTION_DAYS=30
MIN_LOCATION_UPDATE_INTERVAL_SECONDS=5

# CORS Allowed Origins
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

---

## Backend Setup & Execution

### 1. Virtual Environment & Dependencies
```powershell
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Database Migrations (Alembic)
Apply all migrations up to the latest revision:
```powershell
alembic upgrade head
```

Verify migration status:
```powershell
alembic current
```

### 3. Run Backend Server
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive Swagger UI: `http://localhost:8000/docs`
- ReDoc Documentation: `http://localhost:8000/redoc`
- API Health Check: `http://localhost:8000/api/v1/health`

### 4. Run Backend Tests
Run the comprehensive 50-test suite against PostgreSQL:
```powershell
pytest -v backend\tests
```

---

## Frontend Setup & Execution

### 1. Dependencies Installation
```powershell
cd frontend
npm install
```

### 2. Run Development Server
```powershell
npm run dev -- --port 5173
```
Accessible at: `http://localhost:5173`

### 3. Production Build & TypeScript Verification
```powershell
npm run build
```
Creates optimized production assets in `frontend/dist/`.

---

## Database Backup and Recovery

### Backup (pg_dump)
```powershell
# Export schema and data to compressed custom archive format
pg_dump -U survey_app -h localhost -p 5432 -F c -b -v -f "survey_management_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump" survey_management

# Export plain SQL format
pg_dump -U survey_app -h localhost -p 5432 -f "survey_management_backup.sql" survey_management
```

### Recovery (pg_restore)
```powershell
# Restore from custom archive format
pg_restore -U survey_app -h localhost -p 5432 -d survey_management -v "survey_management_backup.dump"

# Restore from plain SQL format
psql -U survey_app -h localhost -p 5432 -d survey_management -f "survey_management_backup.sql"
```

---

## Production Deployment Checklist

1. **Database:**
   - Provision a managed PostgreSQL 16+ instance (AWS RDS, GCP Cloud SQL, or DigitalOcean Managed Database).
   - Execute `alembic upgrade head` in the deployment pipeline.
   - Configure connection pooling via PgBouncer if scaling beyond 100 concurrent workers.
2. **Secrets & Environment:**
   - Generate high-entropy 64-character `SECRET_KEY`.
   - Ensure `.env` is mounted securely via secret managers (AWS Secrets Manager, Vault, or Kubernetes Secrets).
   - Set `FIRST_SUPERUSER_PASSWORD` to a secure production passphrase.
3. **Frontend Reverse Proxy & Static CDN:**
   - Host `frontend/dist` on Cloudflare Pages, S3+CloudFront, or Nginx.
   - Configure Nginx or Caddy to forward `/api/` traffic to `http://backend:8000` with HTTP/2 and TLS 1.3.
4. **CORS:**
   - Update `BACKEND_CORS_ORIGINS` to only whitelist your production domain (`https://app.yourorganization.com`).
