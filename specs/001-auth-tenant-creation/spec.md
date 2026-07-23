# Feature Specification: Authentication and Tenant Creation

**Feature Branch**: `001-auth-tenant-creation`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "autenticação e criação de tenant"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Registration (Priority: P1)

A representative of a BPO or accounting firm visits the platform for the first time.
They fill in their name, organization name, email address, and a password. Upon
submitting, the system creates their personal account and automatically creates a
Tenant record named after their organization. They are immediately directed to the
dashboard, fully onboarded and ready to work.

**Why this priority**: Without registration and automatic Tenant creation, no other
feature in the platform is accessible. This is the entry gate for every customer.

**Independent Test**: Can be fully tested by completing the registration form as a
new user and verifying that (a) the dashboard loads and (b) the organization name
appears in the UI, confirming both the account and the Tenant were created.

**Acceptance Scenarios**:

1. **Given** a visitor with no existing account, **When** they submit valid registration
   details (full name, organization name, email, password), **Then** a personal account
   is created, a Tenant record is created with the organization name, and they are
   directed to the dashboard.
2. **Given** a visitor attempting to register with an email already in use, **When**
   they submit the form, **Then** the system shows a clear error and no duplicate
   account is created.
3. **Given** a visitor submitting a password shorter than 8 characters, **When** they
   submit the form, **Then** the system rejects it with specific guidance before any
   account creation occurs.

---

### User Story 2 - Returning User Login (Priority: P2)

A Tenant Admin or Operator who already has an account returns to the platform. They
enter their email and password. The system validates their credentials, restores their
session, and redirects them to their dashboard. If they try to access a protected page
without being logged in, they are redirected to the login screen first.

**Why this priority**: Every active customer must be able to log back in. Without
login, the platform is inaccessible after the first session.

**Independent Test**: Can be tested by logging out of an existing account and logging
back in, verifying that the dashboard loads with the correct Tenant context.

**Acceptance Scenarios**:

1. **Given** a registered user with valid credentials, **When** they submit the login
   form, **Then** their session is established and they are directed to the dashboard.
2. **Given** a registered user who enters a wrong password, **When** they submit the
   login form, **Then** the system shows a generic error without disclosing which
   field is wrong.
3. **Given** an unauthenticated visitor who navigates directly to a protected route,
   **When** the page loads, **Then** they are immediately redirected to the login page
   and after successful login are forwarded to the originally requested page.

---

### User Story 3 - Password Recovery (Priority: P3)

A user has forgotten their password. They use the password recovery link on the login
page, enter their registered email, and receive a reset link. Clicking the link takes
them to a page where they set a new password and are then redirected to login.

**Why this priority**: Password recovery prevents permanent account lockout, but the
platform is usable without it for users who remember their credentials.

**Independent Test**: Can be tested end-to-end by requesting a reset link, clicking
it from the email, setting a new password, and confirming the new credentials work
at login.

**Acceptance Scenarios**:

1. **Given** a user on the password recovery page, **When** they submit a registered
   email address, **Then** they receive a reset email within 2 minutes and the UI
   confirms the email was sent without revealing whether the address exists.
2. **Given** a user who clicks a valid reset link, **When** they set a new password
   meeting requirements, **Then** the password is updated and they are redirected to
   login with a success message.
3. **Given** a user who clicks an expired or already-used reset link, **When** the
   page loads, **Then** the system shows a clear error and offers to send a new link.

---

### Edge Cases

- Double-submission of the registration form: only one account and one Tenant are
  created; the second submission is rejected.
- Browser closed mid-registration: no partial account or Tenant record is created.
- Password reset requested for an unregistered email: the UI shows the same
  confirmation message as for a registered email (prevents account enumeration).
- Session expires while the user is on a protected page: the next interaction
  redirects them to login without silently losing their place.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow new users to register using a valid email address,
  a password, their full name, and their organization name.
- **FR-002**: System MUST automatically create a Tenant record upon successful
  registration, using the provided organization name as the Tenant name.
- **FR-003**: System MUST assign the registering user the Tenant Admin role within
  the newly created Tenant.
- **FR-004**: System MUST validate that the registration email is not already in use
  and display a clear error if it is.
- **FR-005**: System MUST enforce a minimum password length of 8 characters and
  reject weaker passwords with specific feedback before account creation.
- **FR-006**: System MUST authenticate returning users via email and password.
- **FR-007**: System MUST maintain the authenticated user's session across page
  navigations within the same browser tab.
- **FR-008**: System MUST redirect unauthenticated users who access any protected
  route to the login page, preserving the originally requested URL for post-login
  redirect.
- **FR-009**: System MUST display the Tenant name in the dashboard after login so
  users can confirm they are in the correct organizational context.
- **FR-010**: System MUST provide a password recovery flow: user submits their email,
  receives a reset link, and can set a new password via that link.
- **FR-011**: System MUST show the same confirmation message for password recovery
  whether or not the submitted email is registered (prevents account enumeration).
- **FR-012**: System MUST invalidate a password reset link after it has been used
  or after its expiry window.

### Key Entities

- **User Account**: Represents an authenticated individual. Key attributes: email
  address, full name, role (Tenant Admin or Tenant Operator), associated Tenant.
  A Tenant can have multiple users; the first registrant is always the Admin.
- **Tenant**: Represents the BPO or accounting firm. Key attributes: organization
  name, creation date, plan (defaults to Starter at creation). A Tenant is created
  exactly once, at the moment its first Admin registers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user completes the full registration flow from form submission
  to dashboard landing in under 90 seconds on a standard broadband connection.
- **SC-002**: A returning user completes login and reaches the dashboard in under
  30 seconds.
- **SC-003**: Every successful registration results in exactly one Tenant record
  being created with no orphaned user accounts and no duplicate Tenants.
- **SC-004**: Password reset emails are delivered and actionable within 2 minutes
  of the request being submitted.
- **SC-005**: Zero protected data is accessible to unauthenticated users; any
  direct URL access to a protected route results in a login redirect.

## Assumptions

- The registering user is always the first and initially only member of their Tenant;
  inviting additional Operators is handled in a separate feature.
- The Tenant billing plan defaults to Starter at creation; Stripe subscription setup
  is out of scope for this feature.
- Social login (Google, GitHub) is out of scope for V1 per the PRD.
- Multi-Factor Authentication (MFA) is explicitly excluded from V1 scope per the PRD.
- Session persistence duration and refresh strategy follow the auth provider's secure
  defaults; no custom session management logic is required.
- The organization name entered at registration can be edited later in Tenant Settings
  (a separate feature); this spec only covers the initial creation.
- Password reset email deliverability relies on the auth provider's built-in
  transactional email; no custom email infrastructure is required for V1.
