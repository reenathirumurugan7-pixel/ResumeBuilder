// CORS helper for the API handlers.
//
// The old behaviour was `Access-Control-Allow-Origin: *`, which let any
// website on the internet call the Gemini proxy from a victim's browser.
// Requests are now only answered with a CORS header when the caller's origin
// is on the allowlist. Requests without an `Origin` header (server-to-server,
// curl, the local Express server) are always allowed through — they are not
// affected by CORS in the first place.

const DEPLOYED_ORIGIN = 'https://resumebuilder-1ca16.web.app'

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

function configuredOrigins() {
  const raw = process.env.AI_ALLOWED_ORIGINS
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((value) => value.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  }
  // Defaults cover the Firebase Hosting deploy plus local development. Vercel
  // publishes three host variables and they are not interchangeable:
  // VERCEL_PROJECT_PRODUCTION_URL is the project's production domain and is
  // always set (preview deployments included), while VERCEL_URL and
  // VERCEL_BRANCH_URL are the individual deployment and branch domains. The
  // production domain is the one a live visitor actually sends, so it is listed
  // first; the other two are kept so preview URLs keep working too. Custom
  // domains still need AI_ALLOWED_ORIGINS set explicitly.
  const vercelOrigins = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]
    .map(toOrigin)
    .filter(Boolean)
  // Set-dedupe: the production URL and the deployment URL are often the same host.
  return [...new Set([DEPLOYED_ORIGIN, ...DEV_ORIGINS, ...vercelOrigins])]
}

// Builds an https origin from a bare Vercel host. Vercel documents these values
// as bare hostnames, but tolerating a scheme that is already present means a
// misconfigured variable cannot silently produce an unmatchable "https://https://"
// entry.
function toOrigin(host) {
  const trimmed = String(host || '').trim()
  if (!trimmed) return ''
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}

/** True when the request origin is allowed to receive a CORS response. */
export function isOriginAllowed(origin) {
  if (!origin || typeof origin !== 'string') return true
  return configuredOrigins().includes(origin.trim().replace(/\/+$/, ''))
}

/**
 * Applies CORS headers to a response. Unknown origins are left without an
 * `Access-Control-Allow-Origin` header, so the browser blocks the response.
 */
export function applyCors(req, res) {
  const origin = req && req.headers ? req.headers.origin : null
  res.setHeader('Vary', 'Origin')
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '600')
  }
}
