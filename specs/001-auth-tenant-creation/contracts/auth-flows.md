# Contract: Supabase Auth API Call Patterns

**Feature**: 001-auth-tenant-creation

Documents the exact Supabase Auth API calls used by the React application for
each authentication flow. These are contracts between the UI layer and Supabase.

---

## Flow 1: Registration (Sign Up)

**Trigger**: User submits the registration form.

**API call**:
```
supabase.auth.signUp({
  email: string,
  password: string,         // minimum 8 characters
  options: {
    data: {
      full_name: string,          // stored in raw_user_meta_data
      organization_name: string   // used by handle_new_user trigger for tenants.name
    }
  }
})
```

**Expected success**: `{ data: { user, session }, error: null }`
- Session is non-null when email confirmation is disabled (recommended for dev).
- Redirect to `/dashboard` on success.

**Expected error cases**:
- "User already registered": show "Este e-mail ja esta cadastrado."
- Any other error: show "Erro ao criar conta. Tente novamente."

---

## Flow 2: Login

**Trigger**: User submits the login form.

**API call**:
```
supabase.auth.signInWithPassword({
  email: string,
  password: string
})
```

**Expected success**: `{ data: { user, session }, error: null }`
- Redirect to `location.state.from` if present, otherwise `/dashboard`.

**Expected error cases**:
- "Invalid login credentials": show "E-mail ou senha incorretos."
- Any other error: show "Erro ao entrar. Tente novamente."

---

## Flow 3: Logout

**Trigger**: User clicks logout (any authenticated page).

**API call**:
```
supabase.auth.signOut()
```

Always succeeds locally (clears session storage). Redirect to `/login` after call.

---

## Flow 4: Session Restore (App Load)

**Trigger**: App mounts (`AuthContext` initialization).

**API call**:
```
supabase.auth.getSession()
```

- Session non-null: user is authenticated; set session in context.
- Session null: user is unauthenticated; `ProtectedRoute` redirects to `/login`.

**Ongoing subscription**:
```
supabase.auth.onAuthStateChange((event, session) => {
  // Update AuthContext on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
})
```

---

## Flow 5: Password Reset Request

**Trigger**: User submits the "Forgot Password" form.

**API call**:
```
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: '<app_base_url>/reset-password'
})
```

Always shows the same confirmation message regardless of whether the email is
registered (prevents account enumeration, satisfies FR-011):
"Se este e-mail estiver cadastrado, voce receberá um link em breve."

---

## Flow 6: Password Reset Completion

**Trigger**: User lands on `/reset-password` after clicking the email link.
Supabase automatically establishes a session from the URL hash token.

**API call**:
```
supabase.auth.updateUser({
  password: string   // new password, minimum 8 characters
})
```

**Expected success**: `{ data: { user }, error: null }`
- Link is invalidated by Supabase automatically after use (satisfies FR-012).
- Redirect to `/login` with toast: "Senha atualizada com sucesso. Faca login."

**Expected error (expired/used link)**: No active session available.
- Show: "Link expirado. Solicite um novo link de recuperacao."
- Provide link to `/forgot-password`.

---

## AuthContext Shape

```
{
  session: Session | null,   // Supabase session object
  user:    User | null,      // Supabase auth user
  profile: Profile | null,   // Row from public.profiles (full_name, role, tenant_id)
  tenant:  Tenant | null,    // Row from public.tenants (name, plan_id)
  loading: boolean           // true while getSession() resolves on app load
}
```

`profile` and `tenant` are fetched immediately after `session` is established
using the authenticated Supabase client (RLS returns only the correct rows).
