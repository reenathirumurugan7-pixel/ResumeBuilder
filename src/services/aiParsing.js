import { getAuthInstance, firebaseConfigured } from '../firebase'
import { normalizeImportedFormData, ResumeImportError } from '../utils/resumeFormShape'

// Optional AI step of the resume import. The file is read and parsed in the
// browser by utils/resumeFileParser.js; this sends only the extracted text to
// /api/ai/parse, which holds the Gemini key server-side and requires a Firebase
// ID token, and returns schema-shaped form data.
//
// The response is never trusted: it goes through the same normalizer the
// offline parser uses, so a malformed or truncated answer is rejected instead
// of reaching the form.

const API_BASE = '/api/ai'
const REQUEST_TIMEOUT_MS = 40000
const MAX_TEXT_LENGTH = 20000

function parseError(message, code, status) {
  const err = new Error(message)
  err.code = code
  if (status) err.status = status
  return err
}

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

/**
 * Asks Gemini to turn extracted resume text into form data.
 *
 * @param {string} text Extracted PDF/DOCX text.
 * @param {'fresher'|'experienced'} resumeType
 * @returns {Promise<{ formData: object, warnings: string[] }>}
 * @throws {Error} With `code` set to 'auth-required', 'not-configured', 'timeout',
 *   'network', 'bad-response' or 'request-failed'.
 */
export async function parseResumeWithAI(text, resumeType = 'fresher') {
  if (!firebaseConfigured) {
    throw parseError('AI parsing is unavailable because Firebase is not configured.', 'not-configured')
  }
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw parseError(
      `The extracted text is too long for AI parsing. Only the first ${MAX_TEXT_LENGTH} characters can be sent.`,
      'request-failed',
    )
  }

  const token = await getAuthToken()
  if (!token) {
    throw parseError('Sign in to import this resume with AI.', 'auth-required')
  }

  let response
  try {
    response = await fetch(`${API_BASE}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: trimmed, resumeType }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw parseError('AI parsing timed out. Please try again.', 'timeout', err)
    }
    throw parseError('Could not reach the AI service. Check your connection and try again.', 'network', err)
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
      throw parseError('Your session expired. Please sign in again.', 'auth-required', null, 401)
    }
    throw parseError(
      (body && body.error) || `AI parsing failed (${response.status}).`,
      'request-failed',
      null,
      response.status,
    )
  }

  if (!body || body.success !== true || !body.formData) {
    throw parseError(
      'The AI parsing endpoint did not return a usable resume. /api/ai/parse is not being served by the AI backend.',
      'bad-response',
    )
  }

  try {
    return normalizeImportedFormData(body.formData, { resumeType })
  } catch (err) {
    if (err instanceof ResumeImportError) {
      throw parseError(err.message, 'bad-response', err)
    }
    throw parseError('The AI returned resume data that could not be read safely.', 'bad-response', err)
  }
}

export default parseResumeWithAI