# Handwritten Data Extraction Platform — Design Spec

**Status:** Approved · **Date:** 2026-09-25 · **Owner:** internal

A private monorepo platform that extracts handwritten information from uploaded
images (via Google Gemini Vision) into structured, editable, exportable records.
Architected so the extraction tool can later become a public SaaS with no major
refactor.

---

## 1. Confirmed decisions

These were settled during brainstorming and drive the architecture:

1. **Mock-first.** No cloud services are provisioned yet. OCR, storage, and auth
   sit behind provider interfaces; mock/dev implementations run today, real
   Gemini/Supabase implementations drop in later via env vars — no refactor.
2. **Extractor is open** (no login) but built SaaS-ready. `uploadedBy` is a free
   string for now; it becomes a `User` FK when accounts arrive.
3. **npm workspaces** for the monorepo (no Turborepo/Nx).
4. **"Partnership Name" = display alias for `userName`.** No separate DB column.
5. **Database:** real PostgreSQL. Developer provides a `DATABASE_URL` (Neon/
   Supabase free tier). Prisma `provider = "postgresql"` from day one.
6. **Preprocessing:** real `sharp`-based steps (grayscale, denoise, contrast,
   auto-brightness, sharpen); **deskew is a marked stub**. Rotate/crop/compress
   happen client-side before upload.

## 2. Monorepo layout

```
/
├─ apps/
│  ├─ extractor/          # Next.js 15 — OCR upload tool (open, SaaS-ready)
│  └─ admin/              # Next.js 15 — admin portal (auth-gated)
├─ packages/
│  ├─ types/              # @extraction/types — Zod schemas + TS types (source of truth)
│  ├─ utils/              # @extraction/utils — pure helpers
│  ├─ ui/                 # @extraction/ui — shadcn/ui, Tailwind preset, tokens
│  ├─ core/               # @extraction/core — OCR service, provider seams, preprocessing
│  └─ db/                 # @extraction/db — Prisma client singleton
├─ prisma/                # schema.prisma + migrations
├─ storage/uploads/       # local image storage (gitignored) until Supabase
└─ package.json, tsconfig.base.json, .env.example
```

`packages/core` is an addition beyond the PRD's list: "reusable OCR service"
needs a shared home that both apps import.

## 3. Provider abstractions (mock-first + SaaS-ready)

All three live in `@extraction/core`, selected by env var via a factory:

| Interface | Now | Later | Env |
|---|---|---|---|
| `OcrProvider` | `MockOcrProvider` (deterministic fields + confidences, simulated latency + failure) | `GeminiOcrProvider` (JSON-only prompt, safe parse, retry once) | `OCR_PROVIDER=mock\|gemini` |
| `StorageProvider` | `LocalStorageProvider` (`storage/uploads/`, served via `/api/files/[key]`) | `SupabaseStorageProvider` (signed URLs) | `STORAGE_PROVIDER=local\|supabase` |
| `AuthProvider` | `DevAuthProvider` (seeded admin, signed-cookie session via `jose`) | `SupabaseAuthProvider` | `AUTH_PROVIDER=dev\|supabase` |

## 4. Data model (Prisma, PostgreSQL)

Enums: `Role {ADMIN, STAFF}`, `ProcessingStatus {PENDING, PROCESSING, NEEDS_REVIEW,
PROCESSED, FAILED}`, `LogLevel {INFO, WARN, ERROR}`.

- **User** `{ id, name, email @unique, role Role @default(STAFF), createdAt, updatedAt }`
- **Record** `{ id, imageUrl, imageKey, fullName?, userName?, phoneNumber?, email?,
  pukNumber?, confidence Float?, fieldConfidences Json?, rawOCR String?,
  status ProcessingStatus @default(PENDING), uploadedBy String?, createdAt, updatedAt }`
  - "Partnership Name" (admin table) binds to `userName`.
  - `fieldConfidences` drives per-field low-confidence highlighting on review.
- **ProcessingLog** `{ id, recordId?, event, level LogLevel, message, meta Json?, createdAt }`

Migration path: `uploadedBy String?` → `User` relation when accounts land.

## 5. OCR pipeline

`upload → preprocess → OcrProvider.extract → parseStructuredData → Zod validate →
editable review → save`. Core functions (pure, TDD-covered): `preprocessImage`,
`extractText` (provider), `parseStructuredData` (safe JSON, tolerant of malformed
model output), `calculateConfidence`. Failed extraction retries once automatically;
all OCR events/errors written to `ProcessingLog`.

## 6. APIs

**Extractor (open):** `POST /api/upload`, `POST /api/process`,
`PATCH /api/records/[id]`, single-record export.
**Admin (gated):** `GET /api/records` (paginate/sort/search/filter),
`GET|PATCH|DELETE /api/records/[id]`, bulk delete, `POST /api/export`
(selected/filtered/all → xlsx/csv, headers auto from schema), `GET /api/dashboard`.
All delegate to `@extraction/core`; admin form mutations use server actions.

## 7. UI system

`@extraction/ui`: Tailwind preset (white/slate + **emerald** accent), CSS-variable
theming (dark-mode ready, `class` strategy), shadcn/ui, Framer Motion transitions.
Shared components: `DataTable`, `StatCard`, `FieldEditor` (confidence badge +
low-confidence highlight), `ImageViewer`, `UploadDropzone`, `EmptyState`,
`ErrorState`, skeletons, `Toaster`. Charts via Recharts (React 19-compatible).

## 8. Security & SaaS-prep

Zod-validated env; Zod at every API boundary; admin middleware + role system;
`RateLimiter` interface (in-memory dev impl, wired but not hard-enforced) swappable
to Redis/Upstash; secrets in env only. Modular seams for credits/usage/
subscriptions/workspaces — **no billing built now**.

## 9. Testing

Vitest across `core`/`utils`/`types`: preprocessing steps, OCR parse/validate,
confidence, export generation. `MockOcrProvider` makes the full flow runnable and
testable with zero cloud keys.

## 10. Delivery phases (each ends in a stop-and-approve gate)

0. **Scaffold** — workspaces, tsconfig, lint/format, `.gitignore`, `.env.example`, git.
1. **Foundation** — `types`, `utils`, `db` (schema), `core` (interfaces + mocks +
   preprocessing + OCR service, tested), `ui` base.
2. **Extractor** — upload → process → review → save (end-to-end on mock OCR).
3. **Admin** — dev auth + login, dashboard, records table, detail/edit/delete.
4. **Exports** — xlsx/csv (selected/filtered/all) + single-record export.
5. **Polish** — empty/error/loading, dark mode, animations, rate-limit scaffold,
   README + swap-in docs for Gemini/Supabase.

## 11. Environment note

Node 26 is bleeding-edge. Native deps (`sharp`) use ABI-stable N-API and should
work; if any native dep fails, pin Node 22 LTS via `.nvmrc`.
