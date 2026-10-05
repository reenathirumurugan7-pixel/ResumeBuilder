# Resume Builder

A client-side resume builder: pick a template, fill in a form, get a live preview,
an ATS score and a PDF/Word download. Resumes can be saved to the cloud, shared
through a public link, and embedded in a QR code for recruiters to scan.

React 19 + Vite, plain CSS, Firebase (Auth + Firestore) and a small serverless
Gemini proxy. Deployed to Vercel.

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

### Optional

| Variable | Notes |
| --- | --- |
| `VITE_RESUME_ORIGIN` | Overrides the origin used in public links and QR codes |

## Repository layout

```
api/
  ai/enhance.js      Vercel serverless function: POST /api/ai/enhance
  ai/parse.js        Vercel serverless function: POST /api/ai/parse
  ai/skill-gap.js    Vercel serverless function: POST /api/ai/skill-gap
  _lib/              Shared API helpers (underscore = not deployed as routes)
server/
  dev-server.js     Express wrapper for local development only
src/
  components/        Editor sections, preview, ATS panel, QR, AI widgets
  config/            Template defaults and config resolution
  context/           AuthContext, TemplateContext
  data/              Template catalogue
  pages/             Route components
  services/          ATS scoring, enhancement rules, AI client
  utils/             Storage, PDF/Word export, photo handling
firestore.rules      Deployed security rules (mirrored in the parent folder)
vercel.json          SPA rewrites, explicitly excluding /api
```

### Why `api/_lib` and `server/`

Vercel turns **every** `.js` file under `/api` into a serverless function unless
the name starts with `_`. Keeping the helpers in `api/_lib/` and the local
Express server in `server/` means exactly three functions are deployed
(`/api/ai/enhance`, `/api/ai/parse` and `/api/ai/skill-gap`) instead of seven, one
of which would have been a listening Express app.

## Security notes

- `firestore.rules` is the real boundary: a resume is readable by anyone when
  `isPublic == true`, otherwise only by its owner. The only anonymous write is
  bumping `views` on a public resume, and the rule pins that to exactly `+1`.
- The AI endpoint requires a valid Firebase ID token and rate-limits per user.
  An origin that is not on the CORS allowlist gets no
  `Access-Control-Allow-Origin` header, so the browser refuses to hand the
  response to that page's JavaScript. The Gemini key never leaves the server.
- The rate limiter is **per-instance**, not global: it is an in-memory map inside a
  single Node process, so on Vercel the ceiling scales with the number of warm
  instances and resets on cold start. It bounds one runaway client on one instance
  and is not a quota or a security boundary. A global limit would need shared state
  (Redis/Upstash or Firestore), which this project deliberately does not add. It
  fails open, so it can never block a legitimate user.
- Local drafts are namespaced per Firebase UID, so signing into a second account
  on the same browser cannot read or overwrite the first account's drafts.

## Firestore rules

Deploy from the folder containing `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel (framework: Vite).
2. Add every variable from the tables above to the project's environment
   variables. Vite variables are needed at **build** time; `GEMINI_API_KEY` and
   `FIREBASE_PROJECT_ID` are read at **runtime** by the function.
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
