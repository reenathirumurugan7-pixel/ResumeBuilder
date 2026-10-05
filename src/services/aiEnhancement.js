import { getAuthInstance, firebaseConfigured } from '../firebase'

const API_BASE = '/api/ai'
const REQUEST_TIMEOUT_MS = 30000

function aiError(message, code, cause, status) {
  const err = new Error(message, cause ? { cause } : undefined)
  err.code = code
  // The HTTP status lets callers tell a rate limit (429) apart from an
  // unavailable or misconfigured model (404/5xx) without matching on wording.
  if (status) err.status = status
  return err
}

// The Gemini proxy verifies a Firebase ID token and spends the owner's API
// budget, so every call must be authenticated. Returns null when nobody is
// signed in, which the caller turns into a helpful "sign in" message instead of
// an opaque 401.
async function getAuthToken() {
  if (!firebaseConfigured) return null
  try {
    const user = getAuthInstance().currentUser
    if (!user) return null
    return await user.getIdToken()
  } catch {
    return null
  }
}

export async function enhanceWithAI(text, type = 'objective') {
  if (!firebaseConfigured) {
    throw aiError(
      'AI enhancement is unavailable because Firebase is not configured.',
      'not-configured',
    )
  }

  const token = await getAuthToken()
  if (!token) {
    throw aiError('Sign in to use AI enhancement.', 'auth-required')
  }

  let response
  try {
    response = await fetch(`${API_BASE}/enhance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, type }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw aiError('The AI request timed out. Please try again.', 'timeout', err)
    }
    throw aiError(
      'Could not reach the AI service. Check your connection and try again.',
      'network',
      err,
    )
  }

  const raw = await response.text().catch(() => '')
  let body = null
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw aiError(
        'Your session expired. Please sign in again to use AI enhancement.',
        'auth-required',
        null,
        401,
      )
    }
    throw aiError(
      body?.error || `AI request failed (${response.status}).`,
      'request-failed',
      null,
      response.status,
    )
  }

  if (!body || typeof body !== 'object') {
    throw aiError(
      'The AI endpoint did not return a valid response. /api/ai/enhance is not being served by the AI backend.',
      'bad-response',
    )
  }

  if (!body.success || !body.result) {
    throw aiError(body.error || 'AI returned no result.', 'request-failed')
  }

  return body.result
}
