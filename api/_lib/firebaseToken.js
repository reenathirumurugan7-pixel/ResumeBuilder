import { createPublicKey, createVerify } from 'node:crypto'

// Verifies Firebase ID tokens (RS256, Google securetoken issuer) using only
// Node's built-in crypto plus Google's public signing certificates.
//
// This deliberately avoids the firebase-admin SDK so that the exact same
// verification runs unchanged in three places:
//   - the local Express dev server (api/server.js)
//   - the Firebase Cloud Function that serves the AI endpoint
//   - any other Node host that mounts api/ai/enhance.js
//
// The Gemini key is never involved here: callers must present a valid Firebase
// ID token in `Authorization: Bearer <token>`.

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const CERTS_TTL_MS = 60 * 60 * 1000
const CLOCK_SKEW_SECONDS = 60

let certsCache = { fetchedAt: 0, keys: null }
let inflight = null

function base64UrlToBuffer(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function decodeSegment(segment) {
  return JSON.parse(base64UrlToBuffer(segment).toString('utf8'))
}

function resolveProjectId() {
  const explicit = process.env.FIREBASE_PROJECT_ID
  if (explicit && explicit.trim()) return explicit.trim()
  // The Vite-prefixed value is present in the local .env, which keeps the
  // dev server working without forcing a second project id to be configured.
  const fromClientEnv = process.env.VITE_FIREBASE_PROJECT_ID
  if (fromClientEnv && fromClientEnv.trim()) return fromClientEnv.trim()
  return ''
}

async function fetchCerts() {
  const now = Date.now()
  if (certsCache.keys && now - certsCache.fetchedAt < CERTS_TTL_MS) {
    return certsCache.keys
  }
  if (inflight) return inflight

  inflight = (async () => {
    const response = await fetch(CERTS_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch Google signing certificates (HTTP ${response.status})`)
    }
    const body = await response.json()
    const keys = {}
    for (const [kid, pem] of Object.entries(body)) {
      keys[kid] = createPublicKey(pem)
    }
    if (Object.keys(keys).length === 0) {
      throw new Error('Google returned an empty signing certificate set')
    }
    certsCache = { fetchedAt: Date.now(), keys }
    return keys
  })().finally(() => {
    inflight = null
  })

  return inflight
}

async function getPublicKey(kid) {
  let keys = await fetchCerts()
  if (!keys[kid]) {
    // An unknown kid almost always means the key was rotated. Force a refresh.
    certsCache = { fetchedAt: 0, keys: null }
    keys = await fetchCerts()
  }
  return keys[kid] || null
}

/**
 * Verifies a Firebase ID token.
 *
 * @param {string} token Raw Firebase ID token.
 * @param {{ projectId?: string }} [options]
 * @returns {Promise<{ uid: string, email: string|null, emailVerified: boolean, claims: object }>}
 * @throws {Error} When the token is missing, malformed, expired or not issued
 *   for the configured Firebase project.
 */
export async function verifyFirebaseIdToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing ID token')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Malformed ID token')
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts
  let header
  let payload
  try {
    header = decodeSegment(headerSegment)
    payload = decodeSegment(payloadSegment)
  } catch {
    throw new Error('Malformed ID token')
  }

  if (header.alg !== 'RS256') {
    throw new Error('Unsupported ID token algorithm')
  }
  if (!header.kid) {
    throw new Error('ID token is missing a key id')
  }

  const projectId = (options.projectId || resolveProjectId()).trim()
  if (!projectId) {
    throw new Error('Server is missing FIREBASE_PROJECT_ID')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    throw new Error('ID token has expired')
  }
  if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw new Error('ID token was issued in the future')
  }
  if (payload.aud !== projectId) {
    throw new Error('ID token was issued for a different project')
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('ID token has an unexpected issuer')
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('ID token is missing a subject')
  }

  const publicKey = await getPublicKey(header.kid)
  if (!publicKey) {
    throw new Error('Unknown ID token signing key')
  }

  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${headerSegment}.${payloadSegment}`)
  verifier.end()
  if (!verifier.verify(publicKey, base64UrlToBuffer(signatureSegment))) {
    throw new Error('ID token signature is invalid')
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    claims: payload,
  }
}

/** Extracts a bearer token from an Express/Node request. */
export function extractBearerToken(req) {
  const header = req && req.headers ? req.headers.authorization || req.headers.Authorization : null
  if (!header || typeof header !== 'string') return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}
