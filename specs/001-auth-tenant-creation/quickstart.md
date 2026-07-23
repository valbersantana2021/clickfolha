# Quickstart Validation Guide: Authentication and Tenant Creation

**Feature**: 001-auth-tenant-creation
**Purpose**: Runnable scenarios to verify the feature works end-to-end. Not a test
suite — a manual validation checklist to confirm before moving to the next feature.

## Prerequisites

1. Supabase project created and SQL from `contracts/database.md` applied:
   - `tenants` and `profiles` tables exist
   - `handle_new_user` trigger is active on `auth.users`
   - RLS enabled and policies applied on both tables
2. Supabase project settings configured:
   - `/reset-password` URL added to the Auth redirect allowlist
   - Password minimum length set to 8 characters
   - Email confirmation disabled (for faster local validation)
3. React app running locally (typically at `http://localhost:5173`)
4. Access to a real email inbox for password reset validation
5. Supabase dashboard open to verify database rows

---

## Scenario 1: New User Registration

**Validates**: US1, FR-001 to FR-005, SC-001, SC-003

1. Navigate to `/register`
2. Fill in: Full Name = `Maria Silva`, Organization = `Contabilidade Teste Ltda`,
   Email = any valid address, Password = `senha123`
3. Click "Criar Conta"

**Expected**:
- [ ] Redirected to `/dashboard`
- [ ] Dashboard shows "Contabilidade Teste Ltda" as the organization name
- [ ] Supabase > `tenants`: one new row with `name = 'Contabilidade Teste Ltda'`,
  `plan_id = 'starter'`
- [ ] Supabase > `profiles`: one row with `full_name = 'Maria Silva'`,
  `role = 'admin'`, `tenant_id` matching the new tenant

**Duplicate email**: Repeat with the same email → "Este e-mail ja esta cadastrado"
appears; no new rows created.

**Weak password**: Try password `abc` → client validation error before submission;
no network call made.

---

## Scenario 2: Login and Route Protection

**Validates**: US2, FR-006 to FR-009, SC-002, SC-005

**Normal login**:
1. Go to `/login`, enter credentials from Scenario 1, click "Entrar"
2. Expected: redirected to `/dashboard`; Tenant name visible

**Wrong password**:
1. Enter correct email, wrong password → "E-mail ou senha incorretos" appears;
   no indication of which field was wrong

**Route protection**:
1. Log out
2. Paste `/dashboard` directly into the browser address bar
3. Expected: immediately redirected to `/login`
4. Log in → redirected back to `/dashboard` (original URL preserved)

---

## Scenario 3: Password Recovery

**Validates**: US3, FR-010 to FR-012, SC-004

1. Log out; go to `/login` > click "Esqueci minha senha"
2. Enter the registered email; click "Enviar link"
3. Expected: same confirmation message regardless of email registration status

**Complete reset**:
1. Click the link in the received email → lands on `/reset-password`
2. Enter new password `novaSenha456`; click "Redefinir Senha"
3. Expected: redirected to `/login` with success toast
4. Login with `novaSenha456` succeeds

**Expired/used link**: Click the same link again → "Link expirado." error with
a link back to the forgot-password page

---

## Scenario 4: Data Isolation

**Validates**: Constitution Principle II

1. Register a second account with a different email and organization `Empresa B`
2. Log in as the first user (from Scenario 1)
3. In browser DevTools console run:
   `supabase.from('tenants').select('*').then(console.log)`
4. Expected: response contains exactly one row (first user's Tenant only);
   `Empresa B` row is NOT present

---

All four scenarios must pass before this feature is considered complete.
