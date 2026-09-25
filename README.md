# Handwritten Data Extraction Platform

A private monorepo platform that extracts handwritten information from uploaded
images into structured, editable, exportable records. Built mock-first so it runs
with **zero cloud keys** today, and swaps in Google Gemini Vision + Supabase later
via env vars — no refactor.

> Design spec: [`docs/superpowers/specs/2026-09-25-handwritten-extraction-platform-design.md`](docs/superpowers/specs/2026-09-25-handwritten-extraction-platform-design.md)

## Apps & packages

| Path | Description |
|---|---|
| `apps/extractor` | Next.js 15 OCR upload tool (open, SaaS-ready) |
| `apps/admin` | Next.js 15 admin portal (auth-gated) |
| `packages/types` | Zod schemas + TS types (single source of truth) |
| `packages/utils` | Pure helpers |
| `packages/ui` | shadcn/ui components, Tailwind preset, design tokens |
| `packages/core` | OCR service, provider seams (OCR/Storage/Auth), preprocessing |
| `packages/db` | Prisma client singleton |

## Requirements

- Node.js (project targets 22 LTS; see `.nvmrc`)
- A PostgreSQL connection string (Neon / Supabase free tier work)

## Getting started

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL
npm run db:generate       # generate Prisma client
npm run db:migrate        # apply schema (needs DATABASE_URL)
npm run dev               # run apps
```

## Status

Under active development — see the spec's phase list. Currently: **Foundation**.
