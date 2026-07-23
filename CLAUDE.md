# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClickFolha** is a B2B SaaS that converts HR Excel spreadsheets into standardized CSV files for payroll system import. The canonical spec is in `.llm/prd.md`. Sample data files (Excel and CSV) live in `arquivos/`.

This repository is in the **planning/pre-build phase** — no application source code exists yet. The stack and architecture below reflect the intended implementation.

## Intended Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend/DB/Auth:** Supabase (PostgreSQL + Supabase Auth + RLS)
- **Payments:** Stripe (Checkout + Customer Portal)
- **File Processing:** `xlsx` (SheetJS) — strictly client-side only

## Critical Architecture Decisions

### 1. Client-Side-Only File Processing (Non-Negotiable)
Excel files must **never** leave the browser. SheetJS reads `.xlsx` in-browser; only metadata (record counts, totals, layout used) is sent to Supabase as an audit log. This is a LGPD compliance guarantee and core product differentiator.

### 2. Multi-Tenant Hierarchy
`Tenant` → `Sub-tenant` → `Layout` → `conversions_log`

- A **Tenant** is a BPO / accounting firm (one per Stripe subscription).
- A **Sub-tenant** is a client company managed by the BPO (logical entity only in V1 — not a login).
- A **Layout** holds the `config_json` that maps Excel columns to CSV output rules.
- Supabase **Row Level Security (RLS)** must be enforced on all tables so Tenants never see each other's data.

### 3. CSV Output Format
The generated CSV follows a strict payroll format:
```
01TC0006,,,                         ← fixed technical header line
Cód.Empregado,Cód. Evento,Referência,Valor do Evento
<rows>
Z,<qty>,,<total_value>              ← summary/footer line
```
See `arquivos/Eventos_da_Folha_TC.csv` and `arquivos/folha_pagamento_evento.csv` for real examples.

### 4. Layout `config_json` Schema
The layout config drives the rule engine. At minimum it encodes:
- Which Excel sheet and header row to use
- Column → field mapping (employee code, event code, reference, value)
- Transformation rules: `padLeft` for employee codes, hour-text-to-decimal conversion (regex `Xhs Ymin → decimal`), direct value pass-through

### 5. Supabase Data Model
```sql
tenants(id, name, stripe_customer_id, plan_id)
sub_tenants(id, tenant_id, name)
layouts(id, sub_tenant_id, name, config_json)
conversions_log(id, tenant_id, sub_tenant_id, layout_id, file_name, records_count, total_value, status, created_at)
```

## Development Workflow (SpecKit)

This repo uses SpecKit for spec-driven development. The workflows are in `.specify/workflows/` and skills are in `.claude/skills/`. Use these skills to progress through specs before implementing:

- `/speckit-clarify` — clarify requirements
- `/speckit-specify` — produce a formal spec
- `/speckit-plan` — generate an implementation plan
- `/speckit-tasks` — break plan into tasks
- `/speckit-implement` — implement from tasks

## V1 Scope (What to Build)

Build these in order:
1. Supabase schema + RLS policies
2. Supabase Auth (email/password) + Tenant auto-creation on sign-up
3. Sub-tenant CRUD (Tenant Admin only)
4. Layout Wizard with Auto-Detect (scan Excel headers for keywords: Matrícula, Codigo, Valor, Horas)
5. Client-side rule engine (SheetJS → config_json → CSV)
6. Preview screen (first 20 rows + totals)
7. CSV download + audit log write to Supabase
8. Billing limit middleware (check monthly conversion count before processing)
9. Stripe integration (Starter + Professional plans)
10. Dashboard + conversion history table

## Out of Scope for V1

- Storing Excel or CSV files on the server (forbidden by design)
- Direct ERP API integrations (Domínio, Alterdata)
- MFA
- Granular per-sub-tenant operator permissions
- Advanced analytics / anomaly detection
