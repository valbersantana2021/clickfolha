# Data Model: Authentication and Tenant Creation

**Date**: 2026-07-23
**Feature**: 001-auth-tenant-creation

## Entities

### 1. User Account (managed by Supabase Auth)

Stored in `auth.users` (internal Supabase schema; not directly accessible via client).
The application never reads or writes this table directly.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key; becomes the `profiles.id` foreign key |
| `email` | text | Unique, validated by Supabase Auth |
| `encrypted_password` | text | Hashed internally; never exposed |
| `raw_user_meta_data` | jsonb | Client-supplied at sign-up: `{ full_name, organization_name }` |
| `created_at` | timestamptz | Managed by Supabase |

### 2. `tenants` Table

One row per BPO/accounting firm. Created atomically by the `handle_new_user` trigger.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | |
| `name` | text | NOT NULL | Organization name from sign-up metadata |
| `plan_id` | text | NOT NULL, default `'starter'` | Billing plan; populated by Stripe feature |
| `stripe_customer_id` | text | NULL | Populated by the Stripe billing feature |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

### 3. `profiles` Table

One row per registered user. Links a Supabase Auth user to a Tenant and stores
application-level attributes (name, role).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK, FK to `auth.users(id)` ON DELETE CASCADE | Same UUID as the auth user |
| `tenant_id` | UUID | NOT NULL, FK to `tenants(id)` | Which Tenant this user belongs to |
| `full_name` | text | NOT NULL | Provided at registration |
| `role` | text | NOT NULL, CHECK IN ('admin', 'operator') | First user is always 'admin' |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

## Relationships

```
auth.users (Supabase internal)
    |
    | 1:1 (created by trigger on sign-up)
    v
profiles
    |
    | many:1
    v
tenants
```

A Tenant can have multiple profiles (multiple users), but V1 creates only one at
registration time. The future Operator invite feature will add more profiles to an
existing Tenant.

## State Transitions

### User Registration

```
Visitor -> [sign-up form] -> auth.users row created
                          -> handle_new_user trigger fires
                          -> tenants row inserted
                          -> profiles row inserted (role: admin)
                          -> Session established -> Dashboard
```

### Login / Logout

```
Visitor -> [login form] -> Supabase Auth validates credentials
                        -> Session JWT issued -> Dashboard
Dashboard -> [logout]   -> Session revoked -> Login page
```

### Password Reset

```
User -> [forgot password] -> resetPasswordForEmail()
                          -> Email delivered (Supabase SMTP)
                          -> User clicks link -> /reset-password (session from URL hash)
                          -> updateUser({ password }) -> Link invalidated
                          -> Redirect to /login
```

## Validation Rules

- `email`: Valid email format, enforced by Supabase Auth.
- `password`: Minimum 8 characters, enforced via Zod schema on the client and via
  Supabase Auth password strength settings in the project dashboard.
- `full_name`: Required, 1-100 characters.
- `organization_name` (becomes `tenants.name`): Required, 1-100 characters.
- `tenants.name`: NOT NULL; no uniqueness constraint (two firms may share a name).
- `profiles.role`: CHECK constraint; only 'admin' or 'operator' allowed.

## RLS Policy Summary

See `contracts/database.md` for full SQL.

| Table | Operation | Policy |
|---|---|---|
| `tenants` | SELECT | User can read only their own Tenant (via profiles join) |
| `tenants` | INSERT | Blocked for all users (trigger only) |
| `tenants` | UPDATE/DELETE | Blocked in V1 |
| `profiles` | SELECT | User can read only their own profile row (id = auth.uid()) |
| `profiles` | INSERT | Blocked for all users (trigger only) |
| `profiles` | UPDATE | User can update only their own row (future: name change) |
