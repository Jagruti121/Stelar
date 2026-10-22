# STELLAR — Agent Rules & Coding Conventions

## 1. Project Identity
- App name: **STELLAR** (Student Talent, Excellence and Leadership opportunities)
- Client: A college; users are FACULTY, HOD, STUDENT
- Single repo: `/web` (React), `/functions` (Cloud Functions), root-level Firebase config

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS, shadcn/ui, Recharts, React Router v6, TanStack Query v5, React Hook Form + Zod, lucide-react |
| Auth | Firebase Authentication (Email/Password) + custom claims for roles |
| Database | Cloud Firestore (modular v10+ SDK — always `firebase/firestore` imports) |
| Realtime | Firestore `onSnapshot` for chat/notifications/polls |
| Presence/Typing | Firebase Realtime Database ONLY (no other RTDB usage) |
| Files | Cloud Storage for Firebase |
| Functions | Cloud Functions 2nd gen, Node 20, TypeScript |
| Hosting | Firebase Hosting |
| Security | Firestore Rules + Storage Rules + App Check |
| Excel | SheetJS `xlsx` (client parse, re-validate in Functions) |
| PDF | jspdf + jspdf-autotable |
| Tests | Vitest + Firebase Emulator tests |

---

## 3. Design System (STRICT — apply on every screen)

### Color Tokens (CSS variables AND tailwind.config extensions)
```
--primary:       #1D4ED8   (blue-700)   → main buttons, links, active nav, key charts
--primary-hover: #1E40AF
--primary-soft:  #EFF6FF   (blue-50)    → selected rows, chips, soft backgrounds
--accent:        #0EA5E9   (sky-500)    → secondary highlights, chart series
--background:    #FFFFFF
--surface:       #F8FAFC                → page background
--border:        #E2E8F0
--text:          #0F172A
--text-muted:    #64748B
--success:       #16A34A
--warning:       #F59E0B
--danger:        #DC2626
```

### Typography
- Font: **Inter** (Google Fonts), fallback `system-ui`
- Page titles: `text-2xl font-semibold leading-8` (24/32)
- Section titles: `text-lg font-semibold leading-7` (18/28)
- Body: `text-sm leading-5` (14/20)
- Captions: `text-xs leading-4` (12/16)

### Components
- **Cards**: `bg-white rounded-xl border border-[--border] shadow-sm p-6`
- **Primary Button**: solid `--primary` bg, white text, hover `--primary-hover`, blue focus ring
- **Secondary Button**: white bg, `--primary` border and text
- **Destructive Button**: `--danger` bg
- All buttons: `focus-visible:ring-2 focus-visible:ring-[--primary] focus-visible:ring-offset-2`

### Layout
- **App Shell**: fixed left sidebar 240px on desktop (white, `--primary-soft` active bg), collapses to bottom tab bar or drawer on mobile
- **Top Bar**: 64px height, global search, notification bell with unread badge, avatar dropdown
- **Auth pages**: split layout — left 40% blue gradient (`#1D4ED8` → `#0EA5E9`) with logo/tagline, right 60% white form card
- **Page background**: `--surface` (#F8FAFC)
- **Dashboards**: KPI cards row (icon in blue-soft circle, big number, label/trend) → charts row

### Required States (every screen must have all three)
- **Loading**: skeleton shimmer using `animate-pulse`
- **Empty**: centered icon (lucide) + message + CTA button
- **Error**: red alert icon + message + retry button

### Charts
- Use **Recharts** only
- Color palette: `--primary` (#1D4ED8), `--accent` (#0EA5E9), and lighter blue shades only
- Always add labels, legends and tooltips

### Tables
- Sticky header (`thead` with `sticky top-0`)
- No zebra stripes — hover row highlight in `--primary-soft`
- Pagination controls
- Mobile: card-list fallback (each row becomes a card)

### Responsiveness & Accessibility
- Mobile-first Tailwind classes
- WCAG AA contrast ratios
- All `<input>` elements must have associated `<label>` (htmlFor)
- Keyboard navigation: focusable elements in logical DOM order
- Toasts for success and failure feedback (sonner or shadcn toast)

---

## 4. Coding Conventions

### TypeScript
- **Strict mode** — `"strict": true` in tsconfig
- No `any` — use proper types or `unknown`
- All Firestore documents have typed converter (`withConverter`)
- All Zod schemas co-located with their form or function in a `schemas/` folder
- Export types from `src/types/` — never inline in components

### File & Folder Structure (web/)
```
src/
  assets/          ← static images, SVG logo
  components/
    ui/             ← shadcn/ui + custom base components
    layout/         ← AppShell, Sidebar, TopBar, AuthLayout
    shared/         ← LoadingSkeleton, EmptyState, ErrorState, etc.
  contexts/         ← AuthContext, etc.
  features/         ← one folder per module (auth/, students/, attendance/, etc.)
    auth/
      components/
      hooks/
      schemas/
      pages/
  hooks/            ← shared hooks (useAuth, useFirestoreDoc, etc.)
  lib/
    firebase.ts     ← initializeApp + service exports
    firestore.ts    ← typed collection refs
    storage.ts      ← storage helpers
  pages/            ← top-level route pages (thin, use feature components)
  router/           ← routes.tsx, guards
  types/            ← Firestore type definitions
  utils/            ← helpers (cn, formatDate, etc.)
  index.css
  main.tsx
  App.tsx
```

### Functions (functions/)
```
src/
  callable/         ← callable function handlers
  triggers/         ← Firestore/Auth trigger handlers
  schemas/          ← shared Zod schemas (also used for validation)
  utils/            ← admin helpers, rate limit, audit log
  index.ts          ← exports all functions
```

### Imports
- Use absolute imports via `@/` alias (configured in Vite + tsconfig)
- Group: 1) React, 2) third-party, 3) `@/` internal — separated by blank lines

### State Management
- **Server state**: TanStack Query (useQuery, useMutation, useInfiniteQuery)
- **UI state**: React useState / useReducer
- **Auth state**: AuthContext + custom `useAuth()` hook
- No Redux, no Zustand (keep it simple)

### Firestore SDK
- Always use modular SDK: `import { collection, doc, getDoc } from 'firebase/firestore'`
- Never use `db.collection()` or `.ref()` patterns
- All writes go through typed helpers in `lib/firestore.ts`
- Real-time: `onSnapshot` only in hooks, always return the unsubscribe fn in `useEffect` cleanup

### Security
- **Never** put secrets in frontend code or Firestore
- Callable Functions always call `context.auth` check first
- Validate all inputs with Zod on both client and server
- File uploads: max 10MB, allowed types enforced in Storage Rules AND UI
- Use random UUIDs for uploaded file names
- Audit log every HOD sensitive action

---

## 5. Role Permissions Matrix

| Action | STUDENT | FACULTY | HOD |
|---|---|---|---|
| Edit own profile | ✅ | — | — |
| View talent search | — | ✅ | ✅ |
| Take attendance | — | ✅ | ✅ |
| Send notifications | — | ✅ | ✅ |
| Upload resources | — | ✅ | ✅ |
| Create communities | — | ✅ | ✅ |
| Bulk upload students | — | — | ✅ |
| Generate activation codes | — | — | ✅ |
| Promote students | — | — | ✅ |
| Reset student passwords | — | — | ✅ |
| Upload results | — | — | ✅ |
| View all dashboards | — | own | ✅ |

Custom claims format: `{ roles: ["FACULTY"] }` or `{ roles: ["FACULTY","HOD"] }`

---

## 6. Firestore Collections Summary
(Full schema in `src/types/firestore.ts`)

- `departments/{deptId}`
- `staff/{uid}`
- `students/{deptCode_batch_division_roll}`
- `activationCodes/{studentId}` — **server-only, allow read/write: if false for clients**
- `studentProfiles/{studentId}` → subcollection `achievements/{achId}`
- `endorsements/{id}`
- `skillsMaster/{skillKey}`
- `subjects/{id}`
- `attendanceSessions/{subjectId_division_date_slot}`
- `attendanceSummary/{studentId}`
- `results/{studentId_semester}`
- `notifications/{id}` → students `students/{id}/inbox/{notificationId}`
- `polls/{id}` → subcollection `votes/{studentId}`
- `communities/{id}` → subcollections `members/{uid}`, `messages/{msgId}`
- `chats/{chatId}` → subcollection `messages/{msgId}`
- `communityInvites/{inviteCode}`
- `resources/{id}`
- `shortlists/{id}`
- `opportunities/{id}` → subcollection `interests/{studentId}`
- `auditLogs/{id}` — **server-write only**
- `rateLimits/{id}` — **server-write only**
- `stats/{scopeId}`

---

## 7. Student ID & Email Convention
- **Student document ID**: `{deptCode}_{batch}_{division}_{roll}` (lowercase, deterministic)
- **Synthetic email**: `{deptCode}.{batch}.{division}.{roll}@students.stellar.local`
- Students never see this email
- Activation code: 8-char random, store only SHA-256 hash in Firestore

---

## 8. Delivery Rules
- **Always stop after each phase** and wait for user approval
- **Before coding each phase**, produce an implementation plan and wait for approval
- **After each phase**, run emulators, verify in browser, provide walkthrough + screenshots
- **Never build multiple phases at once**
- **Save these rules** — reference them before every code change
