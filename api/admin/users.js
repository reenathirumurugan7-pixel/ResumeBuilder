import { applyCors } from '../_lib/cors.js'
import { extractBearerToken, verifyFirebaseIdToken } from '../_lib/firebaseToken.js'
import { getAdminAuth } from '../_lib/admin.js'
import { readJsonBody } from '../_lib/body.js'
import { consumeRateLimit } from '../_lib/rateLimit.js'

// Server-side admin API. Only users whose verified Firebase ID token carries
// the `admin: true` custom claim may call it. This is the enforcement boundary
// for actions the browser SDK cannot perform (listing, disabling and deleting
// Firebase Auth users); the React AdminRoute only hides the page, so the claim
// is always re-checked here.

// User listing is capped so one request cannot pull an unbounded user directory.
const MAX_USERS = 1000

// Admin traffic is low-volume, so reads and writes get their own modest budget.
// consumeRateLimit() is per-instance and fails open (see _lib/rateLimit.js); it
// bounds a runaway client without ever permanently blocking a legitimate admin.
const RATE_WINDOW_MS = 60 * 1000
const READ_RATE_LIMIT = 60
const WRITE_RATE_LIMIT = 30

// UIDs issued by Firebase Auth (and this app's email/password sign-up) are
// URL-safe. Validating the shape before it reaches the Admin SDK rejects
// malformed input instead of letting it surface as an SDK error.
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

// `code` values set by _lib/admin.js when a credential cannot be loaded. They
// all map to one generic client message so no filesystem path or credential
// detail can be returned.
const CREDENTIAL_ERROR_CODES = new Set([
  'ADMIN_CREDENTIAL_MISSING',
  'ADMIN_CREDENTIAL_UNREADABLE',
  'ADMIN_CREDENTIAL_INVALID',
  'ADMIN_INIT_FAILED',
])

async function requireAdmin(req, res) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return null
  }

  const token = extractBearerToken(req)
  if (!token) {
    res.status(401).json({ success: false, error: 'You must be signed in to use the admin API.' })
    return null
  }

  let identity
  try {
    identity = await verifyFirebaseIdToken(token)
  } catch {
    res.status(401).json({ success: false, error: 'Your session expired. Please sign in again.' })
    return null
  }

  if (!identity.claims || identity.claims.admin !== true) {
    res.status(403).json({ success: false, error: 'Admin access is required.' })
    return null
  }

  return identity
}

// Intentionally excludes auth tokens, password hashes and provider metadata: a
// user directory is sensitive enough without carrying credentials material.
function publicUserRecord(user) {
  return {
    uid: user.uid,
    email: user.email || null,
    emailVerified: user.emailVerified === true,
    displayName: user.displayName || null,
    disabled: user.disabled === true,
    creationTime: user.metadata && user.metadata.creationTime ? user.metadata.creationTime : null,
    lastSignInTime: user.metadata && user.metadata.lastSignInTime ? user.metadata.lastSignInTime : null,
    admin: Boolean(user.customClaims && user.customClaims.admin === true),
  }
}

async function listUserRecords() {
  const records = []
  let nextPageToken
  while (records.length < MAX_USERS) {
    const page = await getAdminAuth().listUsers(MAX_USERS, nextPageToken)
    for (const user of page.users) {
      records.push(publicUserRecord(user))
    }
    if (!page.pageToken) break
    nextPageToken = page.pageToken
  }
  return records.slice(0, MAX_USERS)
}

export default async function handler(req, res) {
  const identity = await requireAdmin(req, res)
  if (!identity) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const isWrite = req.method === 'POST'
  const { allowed, retryAfterSeconds } = consumeRateLimit(
    `admin:${identity.uid}:${isWrite ? 'write' : 'read'}`,
    { limit: isWrite ? WRITE_RATE_LIMIT : READ_RATE_LIMIT, windowMs: RATE_WINDOW_MS },
  )
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    res.status(429).json({
      success: false,
      error: 'Too many admin requests. Please wait a moment and try again.',
    })
    return
  }

  try {
    if (req.method === 'GET') {
      const users = await listUserRecords()
      res.json({ success: true, users, count: users.length })
      return
    }

    const parsed = readJsonBody(req)
    if (!parsed.ok) {
      res.status(400).json({ success: false, error: parsed.error })
      return
    }

    const { action, uid } = parsed.body
    if (!uid || typeof uid !== 'string' || !uid.trim()) {
      res.status(400).json({ success: false, error: 'A user uid is required.' })
      return
    }
    if (action !== 'disable' && action !== 'enable' && action !== 'delete') {
      res.status(400).json({ success: false, error: 'Unknown action.' })
      return
    }

    const targetUid = uid.trim()
    if (!UID_PATTERN.test(targetUid)) {
      res.status(400).json({ success: false, error: 'The user uid is not valid.' })
      return
    }

    // Never let an admin disable or delete their own account through this API:
    // it would immediately revoke their own access with no way back in.
    if (targetUid === identity.uid && action !== 'enable') {
      res.status(403).json({
        success: false,
        error: 'You cannot disable or delete your own account.',
      })
      return
    }

    const auth = getAdminAuth()

    // Look the target up first so an admin account can be protected from
    // disable/delete. Admin status is only ever changed by scripts/set-admin.js,
    // so blocking it here means the last admin can never be removed by mistake.
    let target
    try {
      target = await auth.getUser(targetUid)
    } catch (error) {
      if (error && error.code === 'auth/user-not-found') {
        res.status(404).json({ success: false, error: 'That user does not exist.' })
        return
      }
      throw error
    }

    const targetIsAdmin = Boolean(target.customClaims && target.customClaims.admin === true)
    if (targetIsAdmin && action !== 'enable') {
      res.status(403).json({
        success: false,
        error: 'Admin accounts cannot be disabled or deleted through this API.',
      })
      return
    }

    if (action === 'delete') {
      await auth.deleteUser(targetUid)
      res.json({ success: true, uid: targetUid })
      return
    }
    const disabled = action === 'disable'
    await auth.updateUser(targetUid, { disabled })
    res.json({ success: true, uid: targetUid, disabled })
  } catch (error) {
    // Never echo error.message to the client: it can contain the service-account
    // file path or raw SDK output. Log only the stable code, then answer with a
    // generic message. `code` is set by _lib/admin.js for credential failures and
    // by firebase-admin for the rest.
    const code = error && typeof error.code === 'string' ? error.code : ''
    console.error(`[admin/users] request failed (${code || 'unknown'})`)

    if (CREDENTIAL_ERROR_CODES.has(code)) {
      res.status(503).json({ success: false, error: 'The admin service is not configured.' })
      return
    }
    if (code === 'auth/user-not-found') {
      res.status(404).json({ success: false, error: 'That user does not exist.' })
      return
    }
    res.status(500).json({ success: false, error: 'The admin service failed.' })
  }
}