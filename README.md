# Survey Management & Live Field Workforce Tracking System

A production-oriented platform for dynamic survey creation, workforce assignment, consent-based live field tracking, and real-time response review.

## Architecture & Tech Stack

### Frontend
- **Framework**: React 18 / 19 + TypeScript (Vite)
- **Styling**: Tailwind CSS
- **State Management & Data Fetching**: Zustand & TanStack Query (React Query)
- **Forms & Validation**: React Hook Form & Zod
- **Maps & Geospatial**: Leaflet & OpenStreetMap
- **Charts & Visualization**: Recharts

### Backend
- **Framework**: FastAPI (Python 3.13)
- **ORM & Database**: SQLAlchemy 2.0 (Synchronous engine) + PostgreSQL 18
- **Migrations**: Alembic
- **Authentication**: JWT access tokens + Argon2id password hashing + refresh token rotation
- **Real-time**: WebSockets (+ Redis when cross-instance scaling is needed)
- **Spatial**: PostGIS for geographic calculations and geofencing

---

## Project Structure

```
SurveyManagmentSystem/
├── backend/
│   ├── app/
│   │   ├── main.py              # Application entrypoint & health endpoints
│   │   ├── core/                # Configuration, security, permissions
│   │   ├── database/            # Database engine & base models
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── api/                 # API routes & dependencies
│   │   └── services/            # Business logic
│   ├── tests/                   # Backend tests
│   ├── requirements.txt         # Python dependencies
│   └── alembic.ini              # Database migration configuration
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── features/            # Feature-specific components and state
│   │   ├── layouts/             # Role-based layouts (Admin, Supervisor, Worker)
│   │   ├── lib/                 # API client, utilities
│   │   └── pages/               # Route pages
│   ├── package.json
│   └── vite.config.ts
├── .env.example                 # Example environment variables
├── .gitignore                   # Git ignore rules
└── README.md                    # Project documentation
```

---

## Getting Started

### 1. Prerequisites
- Python 3.12+ (Python 3.13 tested)
- Node.js 20+ (Node.js 24 tested) & npm
- PostgreSQL 16+ (PostgreSQL 18 recommended)

### 2. Environment Setup
Copy the environment example file:
```bash
cp .env.example .env
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Health Check: `http://localhost:8000/api/v1/health`
API Docs: `http://localhost:8000/docs`

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: `http://localhost:5173`

---

## Development Phases
- [x] **Phase 0**: Project Planning, Repository Initialization & Architecture Setup
- [ ] **Phase 1**: Database & Identity Foundation (Roles, Users, Teams, Auth)
- [ ] **Phase 2**: Frontend Foundation & Authentication Flows
- [ ] **Phase 3**: Survey Management & Dynamic Survey Builder
- [ ] **Phase 4**: Task Management & Workforce Allocation
- [ ] **Phase 5**: Survey Collection & Review Workflow
- [ ] **Phase 6**: Live Workforce Tracking (Consent & Geolocation)
- [ ] **Phase 7**: Real-time Communication & Support Tickets
- [ ] **Phase 8**: Analytics, Reports & Administration
- [ ] **Phase 9**: Security Hardening, Integration Testing & Optimization
- [ ] **Phase 10**: Production Deployment & DevOps
