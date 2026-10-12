# Admin Console — Guide

The app ships an internal admin console at `/admin` for moderating resumes,
reviewing public feedback, administering Firebase Auth users, and inspecting
templates and analytics. It is **not** exposed by default: an account becomes an
admin only when a trusted server process grants its ID token the `admin: true`
**custom claim**. See [README.md](./README.md) for the project overview.

## Console features and routes

The console is a single guarded shell (`src/pages/admin/AdminLayout.jsx`) with
seven child routes. The shell — and therefore every child — is wrapped **once**
in `AdminRoute`, which renders the nested `<Outlet/>` only after the claim is
verified.

| Route | Nav label | What it does |
| --- | --- | --- |
| `/admin` | Overview | Live counts across users, resumes and feedback |
| `/admin/users` | Users | Registered Firebase Auth accounts; disable, enable or delete them via the server API (passwords and tokens are never returned) |
| `/admin/resumes` | Resumes | Every stored resume, including private drafts; deleting here is permanent for the owner |
| `/admin/feedback` | Feedback | Submissions from the public feedback page; deleting removes them permanently |
| `/admin/analytics` | Analytics | Live totals for resumes, views, downloads and QR scans, plus ATS/completion averages and a most-viewed list |
| `/admin/templates` | Templates | The template catalogue compiled into this build (read from the client bundle) |
| `/admin/settings` | Status | Read-only view of how admin access is granted and enforced; it changes nothing |

Admins also get an **Admin Panel** link to `/admin` in the site navbar
(`src/components/Navbar.jsx`); normal users and signed-out visitors never see it.

## Authorization

Access requires a signed-in Firebase user whose verified ID token carries
`admin: true`. The claim can never be granted or revoked from inside the app —
only `scripts/set-admin.js` (or the server API) can do that. It is enforced in
these places:

- `src/hooks/useIsAdmin.js` — resolves the claim from the ID token. It forces a
  token refresh (`getIdTokenResult(true)`) so a just-granted claim is seen
  immediately, and coalesces concurrent readers (the navbar and the route guard
  share one in-flight refresh). The cached token result is consulted only as a
  fallback when the forced refresh fails. When the account changes, the previous
  claim is dropped before the new session paints.
- `src/components/AdminRoute.jsx` — UI gate. Waits for the claim, sends a
  signed-out user to `/login` (carrying the return path) and a signed-in
  non-admin to `/dashboard`. One wrapper around the layout protects all seven
  child routes.
- `firestore.rules` — data gate. `isAdmin()` lets admins read/delete resumes and
  versions and read/delete feedback. **This file currently differs from the
  parent copy — see section 1.**
- `api/admin/users.js` — server gate. Re-verifies the ID token and the claim
  before any Auth-admin action (see section 6).

The UI gate only hides the console; the real boundaries are `firestore.rules`
and the server API, which re-check the claim independently.

## 1. Firestore rules — do not deploy yet

> **The two rules files differ. Deployment is blocked until this is resolved.**
>
> - `firestore.rules` (this folder) defines `isAdmin()` and lets
>   admins read/delete resumes, versions and feedback.
> - The parent folder's `..\firestore.rules` has **no** `isAdmin()` and **no**
>   feedback rules.
>
> Each folder has its own `firebase.json` pointing at its own `firestore.rules`,
> and both `.firebaserc` files pin `resumebuilder-1ca16`. Running
> `firebase deploy --only firestore` from the wrong directory would publish rules
> **without admin support** and break the console.
>
> Reconciling the two files is tracked as **Item 1**. Until it is done, **do not
> deploy the Firestore rules.** Once resolved, deploy from the single agreed
> folder:
>
> ```bash
> firebase login
> firebase deploy --only firestore:rules
> ```

For reference, this folder's rules keep non-admin behaviour unchanged: public
resumes stay public, owners still own their resumes, admins may read/delete for
moderation, and feedback stays write-only for everyone except admins.

## 2. Create a service account

Firebase Console → Project settings → Service accounts → **Generate new private
key**. The downloaded JSON is a **root credential**: store it somewhere safe and
never commit it. It lets the admin API and the provisioning script talk to the
Firebase Auth / Firestore servers.

## 3. Configure the credential

All of the variables below are **server-side only**. Their values must never be
committed and must never be given a `VITE_` prefix — every `VITE_` value is
inlined into the browser bundle. They resolve in this order, implemented
identically in `api/_lib/admin.js` and `scripts/set-admin.js`:

1. `FIREBASE_SERVICE_ACCOUNT` — the service-account JSON, or its base64 form.
2. `FIREBASE_SERVICE_ACCOUNT_PATH` — a filesystem path to the JSON file.
3. Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` locally).

`FIREBASE_PROJECT_ID` names the project the SDK talks to; it falls back to
`VITE_FIREBASE_PROJECT_ID` when unset, but should be set explicitly in
production.

### Locally

Copy `.env.example` to `.env` (git-ignored) and set one credential source — the
inline value **or** a path, not both:

```env
# Option A — inline service-account JSON or its base64 form
FIREBASE_SERVICE_ACCOUNT=
FIREBASE_PROJECT_ID=resumebuilder-1ca16

# Option B — path to the downloaded JSON file
FIREBASE_SERVICE_ACCOUNT_PATH=
FIREBASE_PROJECT_ID=resumebuilder-1ca16
```

Leave the values blank in the file you commit; paste the real credential only
into your local `.env` (or your host's dashboard).

### On Vercel

Add `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID` under **Project →
Settings → Environment Variables**, scoped to Production (add Preview if you
want it there). Use **normal** environment variables, not background/"sensitive"
storage, so the Serverless Function can read them at runtime — Vercel's
background environment variables are not passed to functions. Paste the value
directly into the dashboard; never commit it and never put it in a `VITE_*`
variable. `FIREBASE_SERVICE_ACCOUNT_PATH` is not useful on Vercel because no
file is shipped with the function.

## 4. Promote an account to admin

```bash
node scripts/set-admin.js you@example.com        # grant
node scripts/set-admin.js <uid> --remove          # revoke
```

Run it from the project root with the credential configured in `.env`. The claim
does not appear in an ID token that is already open, so sign out and back in (or
rely on the forced refresh in `useIsAdmin`) before expecting it to take effect.

## 5. Deploy + verify

> **Host not finalised.** `vercel.json` and the `api/` handlers currently target
> Vercel, but no production host has been agreed. The parent folder's
> `firebase.json` configures Firebase Hosting with a catch-all rewrite to
> `index.html`; it does **not** route or run the `api/` functions, so Firebase
> Hosting must not be assumed to work until that is verified. Deploy only after
> section 1 is resolved.

Current (Vercel) flow:

```bash
npm run lint && npm run build
vercel --prod        # or push to a connected git repo
```

`vercel.json` rewrites every non-`/api` path to `index.html`, so `/admin` deep
links work, and `api/admin/users.js` is deployed as the `/api/admin/users`
Serverless Function automatically.

Then open `https://<your-app>.vercel.app/admin` as the promoted account. You
should see the admin shell with Overview / Users / Resumes / Feedback /
Analytics / Templates / Status. Visiting as a signed-in non-admin redirects to
`/dashboard`.

## 6. Admin API safeguards

`/api/admin/users` (`api/admin/users.js`) enforces, in order:

- **Authentication** — a Bearer ID token is required; a missing or unverifiable
  token gets `401`.
- **Admin claim** — a verified token without `admin: true` gets `403`.
- **Method** — only `GET` (list) and `POST` (action) are allowed; anything else
  gets `405`.
- **Rate limiting** — per admin uid and per method (60 reads / 30 writes per
  minute). Over budget returns `429` with a `Retry-After` header. The limiter is
  per-instance and fails open, so it bounds a runaway client without blocking a
  legitimate admin.
- **UID validation** — the target uid must match `^[A-Za-z0-9_-]{1,128}$` before
  it reaches the Admin SDK, otherwise `400`.
- **Self-protection** — an admin cannot disable or delete their **own** account
  (`403`); enabling is allowed.
- **Admin-account protection** — an admin cannot disable or delete another admin
  account (`403`), so the last admin can never be removed via the API. Revoking
  admin is a deliberate, separate action through `scripts/set-admin.js`.
- **Not-found** — a uid with no Firebase user returns `404`.
- **Error hygiene** — credential-loading failures return a generic `503`; other
  failures return a generic `500`. Raw SDK messages and filesystem paths are
  never returned to the client — the detail stays server-side.

The list endpoint is capped at 1000 rows (`MAX_USERS`) per request.

## Notes & pitfalls

- **Do not** grant the claim to a disposable/throwaway login. An admin can
  delete users, disable accounts and delete resume documents.
- Testing the admin API locally: `GET /api/admin/users` must answer `401`
  without a token and `403` with a verified non-admin token. The dev server logs
  the mounted routes on startup.
- Firestore rule changes take effect immediately after a rules deploy; there is
  no cache to purge. Emulator-style offline rule testing needs a project or
  emulator — none is configured here.
- `npm run dev:all` starts both Vite and the local API (`scripts/dev-all.mjs`);
  `npm run dev:server` starts only the API on port 3001.
