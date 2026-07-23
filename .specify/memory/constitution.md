<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 1.0.0
Initial ratification from blank template.

Modified principles: N/A (first fill)
Added sections:
  - Core Principles (5 principles)
  - Technical Constraints
  - Development Workflow
  - Governance
Removed sections: N/A

Templates reviewed:
  ✅ .specify/templates/plan-template.md — Constitution Check section is generic;
     will be populated per-feature. No breaking references found.
  ✅ .specify/templates/spec-template.md — Requirements/FR pattern is compatible.
  ✅ .specify/templates/tasks-template.md — Phase structure aligns with V1 build
     order. No hardcoded principle references to update.
  ✅ .claude/skills/speckit-*/SKILL.md — No CLAUDE-only or stale agent references
     found that conflict with these principles.

Deferred TODOs: None. All placeholders resolved.
-->

# ClickFolha Constitution

## Core Principles

### I. Client-Side Processing (NON-NEGOTIABLE)

All Excel file content MUST be processed exclusively in the browser using SheetJS.
No file bytes, row data, salary figures, or employee records MUST ever be
transmitted to any server (Supabase, edge function, or third-party service).

- The `xlsx` library MUST be used strictly on the client; it MUST NOT be imported
  or invoked in any server-side or edge runtime.
- The only data that MAY leave the browser after a conversion is the audit metadata
  payload: `{ file_name, records_count, total_value, status, layout_id }`.
- Any feature that would require uploading file content to a server MUST be rejected,
  regardless of claimed security guarantees.

**Rationale**: This is the primary LGPD (Brazilian Data Privacy Law) compliance
guarantee and the core product differentiator. Violating it voids the product's
privacy promise to every customer.

### II. Multi-Tenant Data Isolation

Every database query MUST be scoped to the authenticated Tenant. No Tenant MUST
ever read, write, or infer data belonging to another Tenant.

- Supabase Row Level Security (RLS) MUST be enabled and enforced on all tables:
  `tenants`, `sub_tenants`, `layouts`, `conversions_log`.
- RLS policies MUST use `auth.uid()` to resolve the Tenant context; client-supplied
  tenant IDs in query parameters MUST NOT be trusted without server-side validation.
- Sub-tenants are logical entities (not logins in V1). Access to a sub-tenant's
  layouts and logs MUST flow exclusively through the parent Tenant's auth context.

**Rationale**: A single RLS misconfiguration in a multi-tenant SaaS exposes all
customers' data simultaneously. Isolation is a non-negotiable correctness property,
not a performance trade-off.

### III. Configuration-Driven Rule Engine

Processing rules MUST be expressed in the `config_json` of a Layout record, not
hardcoded in application logic. The rule engine MUST be generic.

- Adding support for a new payroll format MUST require only creating or editing a
  Layout (via the Wizard UI), never modifying engine source code.
- The engine MUST support at minimum these rule types via `config_json`:
  - `direct_value`: pass numeric value as-is
  - `hours_to_decimal`: convert text `Xhs Ymin` to decimal hours
  - `pad_left`: zero-pad employee codes to a fixed width
- The CSV output format is fixed and MUST NOT be parameterized per-layout:
  header line `01TC0006,,,`, column order
  `Cod.Empregado,Cod. Evento,Referencia,Valor do Evento`, footer line
  `Z,<qty>,,<total_value>`.

**Rationale**: Payroll teams manage dozens of Excel formats across clients. A
config-driven engine lets non-engineers add formats without code deployments.

### IV. Metadata-Only Audit Trail

The `conversions_log` table MUST store only statistical metadata.
Personally Identifiable Information (PII) and payroll data MUST NOT be persisted
server-side.

- Permitted fields: `id`, `tenant_id`, `sub_tenant_id`, `layout_id`, `file_name`,
  `records_count`, `total_value`, `status`, `created_at`, `operator_user_id`.
- Prohibited: employee names, CPF/RG numbers, individual salary values, bank data,
  or any row-level payroll data.
- The audit log write MUST occur after the CSV is generated and downloaded, never
  before (download MUST NOT be gated on a successful log write).

**Rationale**: Storing individual payroll data would trigger LGPD obligations for
sensitive data handling and contradict Principle I. The audit log exists for usage
metering and traceability, not data archival.

### V. V1 Scope Discipline (YAGNI)

Features not listed in the V1 Scope (.llm/prd.md section 8) MUST NOT be implemented,
even if technically trivial. Scope additions require an explicit PRD amendment.

- Out-of-scope items are documented in .llm/prd.md section 10 and are hard
  boundaries, not deferred backlog items.
- Abstractions MUST NOT be introduced for hypothetical future requirements. Three
  similar lines is preferable to a premature helper.
- Billing limit middleware MUST gate processing (not just warn): if a Tenant has
  reached their monthly conversion limit, the conversion MUST be blocked before
  SheetJS is invoked.

**Rationale**: The codebase is being built from scratch. Scope creep at the
foundation phase is disproportionately expensive to reverse.

## Technical Constraints

The following stack choices are fixed for V1 and MUST NOT be substituted without
a constitution amendment:

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript + Vite |
| UI components | Tailwind CSS + shadcn/ui |
| File processing | SheetJS (xlsx) -- client-side only |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| Payments | Stripe Checkout + Customer Portal |
| Toasts / feedback | Sonner |

Supabase file Storage MUST remain disabled; the bucket MUST NOT be created, to
remove any temptation to upload files.

## Development Workflow

Features MUST follow the SpecKit spec-driven workflow before implementation:

1. `/speckit-clarify` -- resolve ambiguities
2. `/speckit-specify` -- produce `specs/<###-feature>/spec.md`
3. `/speckit-plan` -- produce `specs/<###-feature>/plan.md` (includes Constitution Check)
4. `/speckit-tasks` -- produce `specs/<###-feature>/tasks.md`
5. `/speckit-implement` -- implement from tasks

The Constitution Check gate in `plan.md` MUST explicitly verify each of the
five principles above before Phase 0 research begins.

## Governance

- This constitution supersedes all other practices within this repository.
- Amendments require: (a) documented rationale, (b) version bump per semver rules
  (MAJOR for principle removals/redefinitions, MINOR for additions, PATCH for
  wording), (c) propagation check across all `.specify/templates/` files.
- All implementation plans MUST pass the Constitution Check gate before coding.
- Complexity violations (deviations from any principle) MUST be documented in the
  plan's Complexity Tracking table with explicit justification.
- Runtime development guidance is in `CLAUDE.md` at the repository root.

**Version**: 1.0.0 | **Ratified**: 2026-07-23 | **Last Amended**: 2026-07-23
