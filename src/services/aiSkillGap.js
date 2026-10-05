import { getAuthInstance, firebaseConfigured } from '../firebase'
import { buildSkillGapPayload, MAX_JOB_DESCRIPTION_LENGTH } from './jobMatch'

// Client for the Job Matcher's AI skill-gap step. Same /api/ai architecture as
// services/aiEnhancement.js and services/aiParsing.js: a relative URL, a Firebase
// ID token in the Authorization header, a bounded timeout, and a typed error so
// the page can tell a rate limit from a network drop without matching on wording.
// The Gemini key stays server-side and is never referenced here.
//
// The response is validated a second time in the browser even though the endpoint
// already sanitised it. That is deliberate: the UI renders arrays, so a shape
// that is not an array must never reach the render, no matter what produced it.

const API_BASE = '/api/ai'
const REQUEST_TIMEOUT_MS = 45000

function gapError(message, code, cause, status) {
  const err = new Error(message, cause ? { cause } : undefined)
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

// Only strings survive, and only the first few of them.
function safeList(value, max) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max)
}

function safeText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Validates and normalises an AI gap analysis.
 * @returns {{summary: string, prioritySkills: string[], missingKeywords: string[],
 *   experienceGaps: string[], suggestions: string[]}|null} null when nothing
 *   usable came back, so the caller can hide the panel rather than render blanks.
 */
export function validateSkillGapAnalysis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const analysis = {
    summary: safeText(raw.summary, 1200),
    prioritySkills: safeList(raw.prioritySkills, 8),
    missingKeywords: safeList(raw.missingKeywords, 10),
    experienceGaps: safeList(raw.experienceGaps, 6),
    suggestions: safeList(raw.suggestions, 8),
  }

  const hasContent =
    analysis.summary ||
    analysis.prioritySkills.length ||
    analysis.missingKeywords.length ||
    analysis.experienceGaps.length ||
    analysis.suggestions.length

  return hasContent ? analysis : null
}

/**
 * Asks Gemini to add judgement on top of the deterministic job match analysis.
 *
 * @param {string} jobDescription
 * @param {object} analysis Result of analyzeJobMatch().
 * @returns {Promise<object>} Validated analysis.
 * @throws {Error} With `code` set to 'not-configured', 'auth-required',
 *   'timeout', 'network', 'bad-response' or 'request-failed'.
 */
export async function analyzeSkillGapWithAI(jobDescription, analysis) {
  if (!firebaseConfigured) {
    throw gapError(
      'AI analysis is unavailable because Firebase is not configured.',
      'not-configured',
    )
  }

  const jd = typeof jobDescription === 'string' ? jobDescription.trim() : ''
  if (!jd) {
    throw gapError('Enter a job description before running AI analysis.', 'request-failed')
  }
  if (jd.length > MAX_JOB_DESCRIPTION_LENGTH) {
    throw gapError(
      `The job description is too long. Only the first ${MAX_JOB_DESCRIPTION_LENGTH} characters can be analyzed.`,
      'request-failed',
    )
  }

  const payload = buildSkillGapPayload(analysis)
  if (!payload) {
    throw gapError(
      'Run the job match analysis before AI analysis.',
      'request-failed',
    )
  }

  const token = await getAuthToken()
  if (!token) {
    throw gapError('Sign in to run AI skill gap analysis.', 'auth-required')
  }

  let response
  try {
    response = await fetch(`${API_BASE}/skill-gap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jobDescription: jd, analysis: payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw gapError('The AI analysis timed out. Please try again.', 'timeout', err)
    }
    throw gapError(
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
      throw gapError(
        'Your session expired. Please sign in again to run AI analysis.',
        'auth-required',
        null,
        401,
      )
    }
    if (response.status === 429) {
      throw gapError(
        (body && body.error) || 'Too many AI analyses. Please wait a moment and try again.',
        'request-failed',
        null,
        429,
      )
    }
    throw gapError(
      (body && body.error) || `AI analysis failed (${response.status}).`,
      'request-failed',
      null,
      response.status,
    )
  }

  if (!body || body.success !== true || !body.analysis) {
    throw gapError(
      'The AI analysis endpoint did not return a usable result. /api/ai/skill-gap is not being served by the AI backend.',
      'bad-response',
    )
  }

  const validated = validateSkillGapAnalysis(body.analysis)
  if (!validated) {
    throw gapError(
      'The AI returned an analysis that could not be read safely.',
      'bad-response',
    )
  }

  return validated
}

export default analyzeSkillGapWithAI