# STELLAR — Student Talent, Excellence and Leadership Opportunities

A production-quality Firebase web app for colleges to centralise student skill discovery and faculty-student collaboration.

---

## 🏗️ Repository Structure

```
stellar/
├── web/                    ← React 18 + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/     ← layout/ (AppShell, Sidebar, TopBar) + shared/ (Skeleton, EmptyState)
│   │   ├── contexts/       ← AuthContext
│   │   ├── features/       ← one folder per feature module (added phase by phase)
│   │   ├── hooks/          ← shared React hooks
│   │   ├── lib/            ← firebase.ts, firestore.ts (typed refs)
│   │   ├── pages/          ← top-level route pages
│   │   ├── router/         ← routes.tsx, guards.tsx, navConfig.tsx
│   │   ├── types/          ← firestore.ts (all Firestore types)
│   │   └── utils/          ← cn.ts (helpers)
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── .env.example        ← copy to .env.local and fill in values
├── functions/              ← Cloud Functions 2nd gen, Node 20, TypeScript
│   └── src/
│       ├── callable/       ← callable function handlers
│       ├── triggers/       ← Firestore/Auth trigger handlers
│       ├── schemas/        ← Zod validation schemas
│       └── index.ts
├── scripts/
│   └── seed.ts             ← seeds emulators with test data
├── firestore.rules         ← Firestore Security Rules (deny-by-default)
├── storage.rules           ← Storage Security Rules
├── firestore.indexes.json  ← composite indexes for all queries
├── database.rules.json     ← RTDB rules (presence + typing only)
├── firebase.json
├── .firebaserc
└── .agent/rules/stellar.md ← agent coding conventions (do not delete)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Firebase CLI 15+: `npm install -g firebase-tools`
- Java 11+ (required for Firebase Emulators)

### 1. Clone and install dependencies

```bash
# Install web dependencies
cd web && npm install

# Install functions dependencies
cd ../functions && npm install
```

### 2. Configure environment variables

```bash
# Copy the example and fill in your Firebase project config
cp web/.env.example web/.env.local
```

Edit `web/.env.local`:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_USE_EMULATORS=true
```

### 3. Set Cloud Function secrets (production only)

```bash
firebase functions:secrets:set FACULTY_REG_CODE
firebase functions:secrets:set HOD_REG_CODE
```

### 4. Start the Firebase Emulator Suite

```bash
# From the repo root
firebase emulators:start
```

Emulator ports:
| Service | Port |
|---|---|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| RTDB | 9000 |
| Hosting | 5000 |
| Emulator UI | **4000** |

### 5. Start the React dev server

```bash
cd web && npm run dev
# App available at http://localhost:5173
```

### 6. Seed the emulators with test data

```bash
npx ts-node --esm scripts/seed.ts
```

---

## 🧪 Running Tests

```bash
# Unit tests (Vitest)
cd web && npm run test

# Functions tests
cd functions && npm run test
```

---

## 📦 Deployment

```bash
# Build the web app
cd web && npm run build

# Deploy everything
firebase deploy

# Deploy only specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

---

## 🔑 Auth Architecture

| Role | How they register | Login method |
|---|---|---|
| STAFF / HOD | Via `/register` form + secret code (callable Function) | Email + Password |
| STUDENT | HOD generates activation code; student activates via `/activate` | Dept + Batch + Division + Roll + Password |

Custom claims format: `{ roles: ["FACULTY"] }` or `{ roles: ["FACULTY", "HOD"] }`

---

## 🗄️ Firestore Data Model

See [`web/src/types/firestore.ts`](web/src/types/firestore.ts) for all collection types.

Key conventions:
- **Student ID**: `{deptCode}_{batch}_{division}_{roll}` (lowercase, deterministic)
- **Student email**: `{deptCode}.{batch}.{division}.{roll}@students.stellar.local` (synthetic, never shown)
- **Chat ID**: sorted UIDs joined by `_`
- **Attendance session ID**: `{subjectId}_{division}_{YYYY-MM-DD}_{slot}` (prevents duplicates)

---

## 🛡️ Security

- Firestore and Storage rules default to **deny all**
- All privileged operations go through **callable Cloud Functions** that re-verify custom claims
- Activation codes stored as **SHA-256 hashes only** (plain code shown once to HOD)
- Registration codes stored in **Firebase Secrets** (`functions:secrets:set`) — never in code or Firestore
- Rate limiting via `rateLimits` collection (5 attempts / 15 min) — client-blocked
- Audit log written for every HOD sensitive action

---

## 📋 Delivery Phases

| Phase | Status | Description |
|---|---|---|
| 0 | ✅ **Complete** | Firebase setup, design system, app shell, routing, data model |
| 1 | 🔲 Pending | Staff registration, login, lockout, role-based guards |
| 2 | 🔲 Pending | HOD student management, Excel upload, activation codes |
| 3 | 🔲 Pending | Student profile, achievements, privacy, student dashboard |
| 4 | 🔲 Pending | Subjects, attendance, results, CGPA |
| 5 | 🔲 Pending | Notifications, polls, study resources |
| 6 | 🔲 Pending | Communities, real-time chat, presence |
| 7 | 🔲 Pending | Talent search, shortlists, endorsements, opportunities |
| 8 | 🔲 Pending | Dashboards, exports, App Check, FCM, Hosting deploy |

---

## 🎨 Design System

- **Primary**: `#1D4ED8` (blue-700)
- **Accent**: `#0EA5E9` (sky-500)
- **Surface**: `#F8FAFC`
- **Font**: Inter
- White-only theme (no dark mode)
- WCAG AA compliant
- Mobile-first responsive

Full design conventions: [`.agent/rules/stellar.md`](.agent/rules/stellar.md)
