---
description: "Task list for Authentication and Tenant Creation"
---

# Tasks: Authentication and Tenant Creation

**Input**: Design documents from `specs/001-auth-tenant-creation/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Scaffold the React project with the full technology stack.

- [ ] T001 Initialize Vite + React 18 + TypeScript project at repo root: `npm create vite@latest . -- --template react-ts`
- [ ] T002 [P] Install and configure Tailwind CSS v3: install `tailwindcss postcss autoprefixer`, run `npx tailwindcss init -p`, update `tailwind.config.ts` with `content: ['./index.html', './src/**/*.{ts,tsx}']`, add `@tailwind` directives to `src/index.css`
- [ ] T003 [P] Install and initialize shadcn/ui: run `npx shadcn-ui@latest init`, then add auth page components: `npx shadcn-ui@latest add button input label card form`
- [ ] T004 [P] Install runtime dependencies: `npm install @supabase/supabase-js react-router-dom react-hook-form zod sonner`
- [ ] T005 Create `src/env.ts` exporting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`; create `.env.local` with placeholder values; add `.env.local` to `.gitignore`

**Checkpoint**: `npm run dev` starts without errors; blank app loads at `localhost:5173`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database objects, Supabase configuration, and shared React
infrastructure that ALL user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Apply `tenants` and `profiles` table DDL from `contracts/database.md` in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
- [ ] T007 Apply `handle_new_user` SECURITY DEFINER function and `on_auth_user_created` trigger from `contracts/database.md` in the Supabase SQL Editor
- [ ] T008 Apply all RLS ENABLE statements and policies for `tenants` and `profiles` from `contracts/database.md` in the Supabase SQL Editor; verify RLS is ON via Dashboard > Table Editor > tenants > RLS badge
- [ ] T009 Configure Supabase project settings: (a) Auth > URL Configuration: add `http://localhost:5173/reset-password` to Redirect URLs; (b) Auth > Password: set minimum length to 8; (c) Auth > Email: disable email confirmation for local dev
- [ ] T010 [P] Create Supabase client singleton in `src/lib/supabase.ts`: import `createClient` from `@supabase/supabase-js`, initialize with env values from `src/env.ts`, export as default `supabase`
- [ ] T011 [P] Create TypeScript types in `src/types/database.ts` for `Tenant` (id, name, plan_id, stripe_customer_id, created_at) and `Profile` (id, tenant_id, full_name, role, created_at) matching `data-model.md`
- [ ] T012 Create `AuthContext` in `src/contexts/AuthContext.tsx`: call `supabase.auth.getSession()` on mount; subscribe to `supabase.auth.onAuthStateChange`; after session is established fetch the authenticated user's `profiles` row then their linked `tenants` row; expose `{ session, user, profile, tenant, loading }` via React context (full shape in `contracts/auth-flows.md`)
- [ ] T013 Create `useAuth` hook in `src/hooks/useAuth.ts`: call `useContext(AuthContext)` and throw an error if used outside the `AuthContext.Provider`; export as default
- [ ] T014 [P] Create `ProtectedRoute` component in `src/components/ProtectedRoute.tsx`: read `{ session, loading }` from `useAuth()`; while loading render a centered spinner; if no session render `<Navigate to="/login" replace state={{ from: location }} />`; otherwise render `children`
- [ ] T015 Set up React Router v6 in `src/App.tsx`: wrap the app in `<AuthContext.Provider>`; add `<Toaster />` from `sonner`; configure routes: public (`/login`, `/register`, `/forgot-password`, `/reset-password`) and `ProtectedRoute`-wrapped (`/dashboard`); redirect root `/` to `/login`
- [ ] T016 Create minimal placeholder `DashboardPage` in `src/pages/DashboardPage.tsx`: read `tenant` from `useAuth()`; render a heading "Bem-vindo, [tenant.name]" — this stub satisfies the post-login redirect target needed by US1 and US2

**Checkpoint**: Foundation ready — all 3 user stories can now be implemented independently

---

## Phase 3: User Story 1 - New User Registration (Priority: P1) - MVP

**Goal**: A new BPO representative registers, triggering atomic Tenant and Profile creation, and reaches the dashboard.

**Independent Test**: Navigate to `/register`, fill in all fields, submit — verify dashboard loads and Supabase `tenants` and `profiles` tables have matching new rows (Quickstart Scenario 1).

- [ ] T017 [US1] Build `RegisterPage` form in `src/pages/RegisterPage.tsx`: define a `zod` schema validating `full_name` (required, max 100 chars), `organization_name` (required, max 100 chars), `email` (valid email format), `password` (min 8 chars); build the form UI using `react-hook-form` + shadcn/ui `Form`, `Input`, `Label`, `Button`, and `Card` components
- [ ] T018 [US1] Wire `RegisterPage` submit handler to `supabase.auth.signUp()` per `contracts/auth-flows.md` Flow 1: pass `full_name` and `organization_name` in `options.data`; on "User already registered" error show Sonner toast "Este e-mail ja esta cadastrado"; on any other error show "Erro ao criar conta. Tente novamente." in `src/pages/RegisterPage.tsx`
- [ ] T019 [US1] On successful `signUp()` redirect to `/dashboard` using `useNavigate()`; disable the submit button and show a loading spinner during submission to prevent double-submit in `src/pages/RegisterPage.tsx`

**Checkpoint**: User Story 1 fully functional and independently testable via Quickstart Scenario 1

---

## Phase 4: User Story 2 - Returning User Login (Priority: P2)

**Goal**: A registered user logs in, sees their Tenant name on the dashboard, and can log out; protected routes block unauthenticated access.

**Independent Test**: Log out then log back in — verify dashboard loads with correct Tenant name; paste `/dashboard` URL while logged out — verify redirect to `/login` with original URL preserved after login (Quickstart Scenario 2).

- [ ] T020 [US2] Build `LoginPage` form in `src/pages/LoginPage.tsx`: define a `zod` schema validating `email` (valid format) and `password` (required); render shadcn/ui form components; add a "Esqueci minha senha" link pointing to `/forgot-password` and a "Criar conta" link pointing to `/register`
- [ ] T021 [US2] Wire `LoginPage` submit handler to `supabase.auth.signInWithPassword()` per `contracts/auth-flows.md` Flow 2: on "Invalid login credentials" show Sonner toast "E-mail ou senha incorretos"; on success redirect to `location.state?.from ?? '/dashboard'` in `src/pages/LoginPage.tsx`
- [ ] T022 [US2] Add logout button in `src/pages/DashboardPage.tsx` calling `supabase.auth.signOut()` followed by `navigate('/login')` using `useNavigate()`

**Checkpoint**: User Stories 1 and 2 both work independently; route protection verified via Quickstart Scenario 2

---

## Phase 5: User Story 3 - Password Recovery (Priority: P3)

**Goal**: A user who forgot their password receives a reset email, sets a new password, and can log in with the new credentials.

**Independent Test**: Request a reset link, click it, set a new password, confirm login works with the new password and that the old link is invalid (Quickstart Scenario 3).

- [ ] T023 [US3] Build `ForgotPasswordPage` in `src/pages/ForgotPasswordPage.tsx`: email-only form with `zod` validation; submit handler calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: import.meta.env.VITE_APP_URL + '/reset-password' })` per `contracts/auth-flows.md` Flow 5; always display "Se este e-mail estiver cadastrado, voce recebera um link em breve." after submission regardless of outcome; add "Voltar para o login" link to `/login`
- [ ] T024 [US3] Build `ResetPasswordPage` in `src/pages/ResetPasswordPage.tsx`: on mount check for an active Supabase session (injected automatically from URL hash); if no session render expired-link error "Link expirado. Solicite um novo link de recuperacao." with link to `/forgot-password`; if session active render new password form (min 8 chars) calling `supabase.auth.updateUser({ password })` per `contracts/auth-flows.md` Flow 6; on success show Sonner toast "Senha atualizada com sucesso. Faca login." and redirect to `/login`
- [ ] T025 [US3] Add `VITE_APP_URL=http://localhost:5173` to `.env.local`; verify `ForgotPasswordPage` reset link redirects correctly to `/reset-password` and that Supabase project redirect allowlist includes the value

**Checkpoint**: All 3 user stories independently functional; run all 4 Quickstart scenarios to confirm complete coverage

---

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Final validation and small UX improvements spanning multiple stories.

- [ ] T026 [P] Verify `<Toaster />` from `sonner` is properly mounted in `src/App.tsx` and that all Sonner toasts from T018, T021, T024 render visually in the browser
- [ ] T027 [P] Add `document.title` updates per page via `useEffect` in each page component: "Criar Conta | ClickFolha" in `src/pages/RegisterPage.tsx`, "Entrar | ClickFolha" in `src/pages/LoginPage.tsx`, "Recuperar Senha | ClickFolha" in `src/pages/ForgotPasswordPage.tsx`
- [ ] T028 Run all 4 validation scenarios from `specs/001-auth-tenant-creation/quickstart.md` end-to-end and confirm each expected outcome passes; log any failures
- [ ] T029 [P] Run Quickstart Scenario 4 (data isolation check): confirm that querying `supabase.from('tenants').select('*')` while logged in as User A returns only User A's Tenant row and not any other Tenant's row

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Phase 2 completion
  - US1, US2, US3 can proceed in parallel once Phase 2 is done
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2; no dependency on US2 or US3
- **US2 (P2)**: Depends only on Phase 2; `DashboardPage` stub (T016) provides the landing target
- **US3 (P3)**: Depends only on Phase 2; the link from `LoginPage` (added in T020) improves UX but US3 can be tested independently at `/forgot-password`

### Within Each User Story

- T017 → T018 → T019 (US1): schema → wiring → redirect
- T020 → T021 → T022 (US2): form → wiring → logout
- T023 → T024 → T025 (US3): forgot-page → reset-page → env/verify

### Parallel Opportunities

Phase 1: T002, T003, T004 run in parallel (separate installs).
Phase 2: T006 → T007 → T008 sequentially (DB objects in order); T010, T011, T014
can run in parallel after T005; T012 depends on T010 and T011; T013 depends on T012;
T015 depends on T012 and T014; T016 depends on T015.
Within user stories: tasks are sequential within a story but different stories can
be worked in parallel by separate developers.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — CRITICAL: blocks everything
3. Complete Phase 3 (US1: T017, T018, T019)
4. **STOP AND VALIDATE**: Run Quickstart Scenario 1 — confirm Tenant and Profile rows appear in Supabase
5. Deploy or demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 complete → foundation ready
2. US1 complete → Quickstart Scenario 1 passes → MVP deploy
3. US2 complete → Quickstart Scenario 2 passes → deploy
4. US3 complete → Quickstart Scenarios 3 and 4 pass → deploy
5. Phase 6 polish → feature complete

---

## Notes

- [P] tasks involve different files and have no incomplete dependencies
- [Story] label maps each task to a user story for traceability
- T006-T009 must be executed in the Supabase dashboard before running the React app
- `VITE_APP_URL` must be set in `.env.local` (T025) before testing password reset
- Commit after each checkpoint to preserve working increments
- Avoid implementing features outside the V1 scope listed in `specs/001-auth-tenant-creation/spec.md` Assumptions section (no MFA, no social login, no Operator invite)
