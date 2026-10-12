# Resume Builder

A client-side resume builder: pick a template, fill in a form, get a live preview,
an ATS score and a PDF/Word download. Resumes can be saved to the cloud, shared
through a public link, and embedded in a QR code for recruiters to scan.

React 19 + Vite, plain CSS, Firebase (Auth + Firestore), a small serverless
Gemini proxy and an internal **admin console** at `/admin`. See
[ADMIN.md](./ADMIN.md) for the console's routes, authorization and server
configuration.

> **The deployment host is not finalised.** `vercel.json` and the `api/`
> handlers currently assume Vercel, but no host has been agreed and nothing
> should be deployed until the [Firestore rules conflict](#firestore-rules) is
> resolved. Do not assume Firebase Hosting can serve the `api/` functions — that
> is unverified.

## Features

- Fresher and experienced resume editors with live preview
- 30 templates plus a customiser (colours, fonts, layout, sections, photo)
- ATS scoring with job-description matching
- Job Description Matcher (`/job-matcher`): deterministic skill, keyword and
  experience gap analysis against a saved resume, with an optional Gemini
  skill-gap review layered on top
- Resume Vault: rename, duplicate, publish/unpublish, delete, view counts
- Public resume pages at `/resume/:resumeId` with a QR code. QR codes encode
  `?src=qr`, which is how a scan is told apart from an ordinary link visit
- Download and QR-scan metrics, tallied once per session and shown on the vault
  cards and the dashboard
- AI-assisted wording improvements (Gemini, authenticated)
- Debounced cloud autosave with cross-device conflict resolution
- Internal admin console at `/admin` (Overview, Users, Resumes, Feedback,
  Analytics, Templates, Status) restricted to accounts holding the `admin: true`
  custom claim — see [ADMIN.md](./ADMIN.md)

## Requirements

- Node.js 20+
- A Firebase project (Auth + Firestore)
- A Gemini API key

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5173
```

The AI features also need the local API server:

```bash
npm run dev:all        # Vite + API server on :3001
```

`vite.config.js` proxies `/api` to `http://localhost:3001`, so the frontend
always calls a relative `/api/ai/enhance`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:server` | Express API server on `:3001` (local only) |
| `npm run dev:all` | Both of the above |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the whole repo |

## Environment variables

`.env` is git-ignored — never commit it. See `.env.example` for the full list.

### Firebase (exposed to the browser, `VITE_` prefix)

| Variable | Notes |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | From Firebase Console → Project settings |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | Also used server-side as a fallback |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional (Analytics) |

### Gemini (server-side only — never prefixed with `VITE_`)

| Variable | Notes |
| --- | --- |
| `GEMINI_API_KEY` | Required for AI features |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash`, a stable model verified against every request shape this project sends. Must be a model your key can actually call — Gemini retired `gemini-2.5-flash` for new users and answers HTTP 404, which surfaces in the UI as an error naming the model. Not every model accepts every shape: `gemini-3.5-flash-lite` answers HTTP 400 on the `thinkingBudget: 0` config, so verify a new model against `/api/ai/enhance`, `/api/ai/parse` **and** `/api/ai/skill-gap`. In production set it explicitly; if unset, all three endpoints fall back to this same default. |
| `FIREBASE_PROJECT_ID` | Used to verify Firebase ID tokens |
| `AI_ALLOWED_ORIGINS` | Comma-separated CORS allowlist |

### Admin console (server-side only — never prefix with `VITE_`)

The `firebase-admin` SDK used by `scripts/set-admin.js` and the
`/api/admin/users` endpoint is configured with the variables below. They are read
only on the server. Their values must **never** be committed and must **never**
be given a `VITE_` prefix: every `VITE_` variable is inlined into the browser
bundle, while a service-account key is a root credential.

| Variable | Notes |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | The service-account JSON, or its base64 form. Preferred on hosts (e.g. Vercel) where no file can be shipped. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to a service-account JSON file on disk. Convenient locally; not usable on a serverless host. |
| `FIREBASE_PROJECT_ID` | Project the Admin SDK talks to (also verifies ID tokens). Falls back to `VITE_FIREBASE_PROJECT_ID` when unset, but set it explicitly in production. |

Credentials resolve in the order `FIREBASE_SERVICE_ACCOUNT` →
`FIREBASE_SERVICE_ACCOUNT_PATH` → Application Default Credentials
(`GOOGLE_APPLICATION_CREDENTIALS` locally). See
[Configure the credential](./ADMIN.md#3-configure-the-credential) for the exact
local and Vercel steps.

### Optional

| Variable | Notes |
| --- | --- |
| `VITE_RESUME_ORIGIN` | Overrides the origin used in public links and QR codes |

## Repository layout

```
api/
  admin/users.js     Serverless function: /api/admin/users (admin-only user admin)
  ai/enhance.js      Vercel serverless function: POST /api/ai/enhance
  ai/parse.js        Vercel serverless function: POST /api/ai/parse
  ai/skill-gap.js    Vercel serverless function: POST /api/ai/skill-gap
  _lib/              Shared API helpers (admin.js = Admin SDK credential, plus
                     auth, CORS, body and rate-limit helpers; underscore =
                     not deployed as routes)
server/
  dev-server.js     Express wrapper for local development only
src/
  components/        Editor sections, preview, ATS panel, QR, AI widgets, AdminRoute
  config/            Template defaults and config resolution
  context/           AuthContext, TemplateContext
  data/              Template catalogue
  hooks/             useIsAdmin (admin-claim resolution)
  pages/             Route components (admin pages under pages/admin/)
  services/          ATS scoring, enhancement rules, AI client
  utils/             Storage, PDF/Word export, photo handling
firestore.rules      Admin-aware rules for THIS folder — the copy in the parent
                     folder differs and lacks admin support (see the warning below)
ADMIN.md             Admin console guide (routes, authorization, server config)
vercel.json          SPA rewrites, explicitly excluding /api
```

### Why `api/_lib` and `server/`

Vercel turns **every** `.js` file under `/api` into a serverless function unless
the name starts with `_`. Keeping the helpers in `api/_lib/` and the local
Express server in `server/` means exactly four functions are deployed
(`/api/admin/users`, `/api/ai/enhance`, `/api/ai/parse` and `/api/ai/skill-gap`)
instead of every helper file also being exposed as a route, one of which would
have been a listening Express app.

## Security notes

- `firestore.rules` is the real boundary: a resume is readable by anyone when
  `isPublic == true`, otherwise only by its owner. The only anonymous write is
  bumping `views` on a public resume, and the rule pins that to exactly `+1`.
- The AI endpoint requires a valid Firebase ID token and rate-limits per user.
  An origin that is not on the CORS allowlist gets no
  `Access-Control-Allow-Origin` header, so the browser refuses to hand the
  response to that page's JavaScript. The Gemini key never leaves the server.
- The admin API (`/api/admin/users`) re-verifies the Firebase ID token and the
  `admin: true` claim on every request (`401` without a token, `403` for a
  verified non-admin). It validates the target uid shape, rate-limits per uid
  (60 reads / 30 writes per minute), refuses to disable or delete the caller's
  own account, and refuses to disable or delete any admin account — so the last
  admin cannot be removed through the API. Credential-loading failures return a
  generic `503` and never leak a file path or SDK message. See
  [Admin API safeguards](./ADMIN.md#6-admin-api-safeguards).
- The rate limiter is **per-instance**, not global: it is an in-memory map inside a
  single Node process, so on Vercel the ceiling scales with the number of warm
  instances and resets on cold start. It bounds one runaway client on one instance
  and is not a quota or a security boundary. A global limit would need shared state
  (Redis/Upstash or Firestore), which this project deliberately does not add. It
  fails open, so it can never block a legitimate user.
- Local drafts are namespaced per Firebase UID, so signing into a second account
  on the same browser cannot read or overwrite the first account's drafts.

## Firestore rules

> **The two rules files currently differ — do not deploy until this is fixed.**
> `firestore.rules` (this folder) defines `isAdmin()` and grants
> admins read/delete on resumes, versions and feedback. The copy one level up in
> the parent folder (`..\firestore.rules`) has **no** `isAdmin()` and **no**
> feedback rules. Because each folder's `firebase.json` points at its own
> `firestore.rules`, deploying from the wrong directory silently publishes rules
> without admin support and breaks the console. Reconciling the two files is
> tracked as **Item 1**; until it is done, do not run
> `firebase deploy --only firestore`.

## Deploying

> **Host not finalised.** The repository contains a Vercel config (`vercel.json`)
> and the `api/` handlers are written as Vercel-style serverless functions, but
> no production host has been agreed. The parent folder's `firebase.json`
> configures Firebase Hosting with a catch-all rewrite to `index.html`; that
> would route `/api` to the SPA too and does not run these Node functions, so
> Firebase Hosting must **not** be assumed to work until that is verified.
> Deploy only after the [Firestore rules conflict](#firestore-rules) is resolved.

The steps below describe the current Vercel setup:

1. Push the repository to GitHub and import it in Vercel (framework: Vite).
2. Add every variable from the tables above to the project's environment
   variables. Vite variables are needed at **build** time; `GEMINI_API_KEY`,
   `FIREBASE_PROJECT_ID` and the admin variables (`FIREBASE_SERVICE_ACCOUNT`)
   are read at **runtime** by the function. Store the admin variables as normal
   (non-`VITE_`) secrets — never commit them.
3. Deploy, then add the resulting Vercel domain to **Firebase Authentication →
   Settings → Authorized domains**, otherwise sign-in fails on that host.
4. If you serve the app from a custom domain, set `AI_ALLOWED_ORIGINS` to it.

## Known limitations

- The PDF exporter paginates automatically: sections that cross the bottom margin
  continue onto the next A4 page instead of being clipped.
- Word export produces a real binary `.docx` (built with `docx`'s `Packer`), so
  it opens as a normal Word document rather than an HTML stand-in.
- Dashboard stats cover resumes, published/draft counts, views, QR scans and
  downloads. Views and scans are counted once per browser session, downloads
  only after the browser has actually received the file; downloads made while
  signed out, or before a resume reaches the cloud, are not recorded.
- The bundled entry chunk is ~796 kB (237 kB gzipped). Pages, the PDF/DOCX
  exporters and QR images are code-split behind `import()`, so what remains is
  mostly React DOM and Firebase; deferring Firestore behind an async `getDb()`
  is the next performance win. The Job Matcher adds no weight to it: the route is
  lazy and lands in its own ~32 kB chunk.
- `npm audit` reports 4 high advisories in `@grpc/grpc-js`, reached through
  `firebase` → `@firebase/firestore`. They are deliberately **not** force-fixed:
  the only fix npm offers is downgrading Firebase to v9, a breaking change to
  Auth, Firestore and storage. Both advisories concern server-side gRPC/mTLS
  behaviour, and the browser build talks to Firestore over WebChannel, so the
  package is never shipped to the browser.
