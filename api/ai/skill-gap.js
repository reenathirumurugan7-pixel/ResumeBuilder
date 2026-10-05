import { extractBearerToken, verifyFirebaseIdToken } from '../_lib/firebaseToken.js'
import { applyCors } from '../_lib/cors.js'
import { consumeRateLimit } from '../_lib/rateLimit.js'
import { readJsonBody } from '../_lib/body.js'

// AI skill-gap analysis for the Job Description Matcher.
//
// This is a third endpoint alongside /api/ai/enhance and /api/ai/parse, on the
// same architecture: the Gemini key is read here and never leaves this file, the
// caller must present a valid Firebase ID token, the request is rate limited on
// its own bucket, and the model's answer is re-validated into a fixed shape
// before it is returned. Neither existing endpoint is modified.
//
// The deterministic analysis (Job Match Score, matching/missing skills, keyword
// sets) is computed in the browser by services/jobMatch.js before this is
// called. Gemini is only asked for the judgement layer on top: what to prioritise
// and how to close the gaps. That split keeps the numbers reproducible and the
// AI optional.

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Keep in sync with GEMINI_MODEL in .env / .env.example.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const MIN_JOB_DESCRIPTION_LENGTH = 80
const MAX_JOB_DESCRIPTION_LENGTH = 20000
const MAX_OUTPUT_TOKENS = 2048
const REQUEST_TIMEOUT_MS = 30000
const RATE_LIMIT = 8
const RATE_WINDOW_MS = 60 * 1000

// Caps on every list the model returns. A gap analysis is a short report, not a
// dump of everything vaguely adjacent to the job.
const CAPS = {
  short: 200,
  summary: 1200,
  list: 12,
}

function text(value, max = CAPS.short) {
  if (typeof value === 'string') return value.trim().slice(0, max)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

// Rebuilds a string list from anything the model produced. A bare string where a
// list belongs is treated as a single-item list, and anything else is dropped,
// so the response shape cannot be broken from the outside.
function stringList(value, max = CAPS.list) {
  const source = Array.isArray(value) ? value : value == null ? [] : [value]
  const seen = new Set()
  const out = []
  for (const item of source) {
    const clean = text(typeof item === 'string' ? item : asObject(item).name ?? asObject(item).title)
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clean)
    if (out.length >= max) break
  }
  return out
}

const SYSTEM_PROMPT = [
  'You are a resume coach. Given a job description and a deterministic analysis of a candidate\'s resume, return JSON only - no prose, no markdown fences.',
  'Use this exact shape:',
  '{',
  '  "summary": string,',
  '  "prioritySkills": [ string ],',
  '  "missingKeywords": [ string ],',
  '  "experienceGaps": [ string ],',
  '  "suggestions": [ string ]',
  '}',
  'Rules:',
  '- prioritySkills: up to 8 skills from missingSkills that matter most for this specific role, most important first.',
  '- missingKeywords: up to 10 important terms from missingKeywords that a recruiter or ATS filter would look for.',
  '- experienceGaps: up to 6 short sentences on what the experience on this resume does not yet demonstrate for this job.',
  '- suggestions: up to 8 concrete, actionable steps. Name the section to edit and what to add.',
  '- summary: one or two sentences on how this resume matches the role overall.',
  '- Only use information present in the job description and the supplied analysis. Never invent a requirement that is not listed.',
  '- Never tell the candidate to claim a skill they do not have. Where a gap is a real blocker, say so plainly.',
  '- Keep every string under 200 characters and write plain text without markdown formatting.',
].join('\n')

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY
  const model = (process.env.GEMINI_MODEL || '').trim() || DEFAULT_GEMINI_MODEL
  return { apiKey, model, baseUrl: `${GEMINI_API_URL}/${model}:generateContent` }
}

// Model output arrives as text, sometimes wrapped in a ```json fence.
function parseModelJson(raw) {
  const trimmed = String(raw || '').trim()
  const withoutFence = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(withoutFence.slice(start, end + 1))
  } catch {
    return null
  }
}

// Forces the model's answer into the exact contract the client renders. Every
// field is rebuilt from scratch, and an answer with no usable content at all is
// rejected so the client can fall back to the deterministic analysis instead of
// rendering an empty AI panel.
//
// `allowedSkills` / `allowedKeywords` are the gaps the deterministic engine
// actually found in this resume. The model is asked to prioritise and explain
// those, never to produce new ones, so anything outside those lists is dropped
// here. That keeps a hallucinated or prompt-injected requirement from reaching
// the UI as if the resume were missing it.
// Exported so the allow-list behaviour can be unit tested without a live Gemini
// key; Vercel only ever uses the default export below.
export function sanitizeAnalysis(raw, allowedSkills = [], allowedKeywords = []) {
  const source = asObject(raw)
  const summary = text(source.summary || source.overview, CAPS.summary)

  const skillIndex = new Set(allowedSkills.map((value) => String(value).toLowerCase()))
  const keywordIndex = new Set(allowedKeywords.map((value) => String(value).toLowerCase()))

  const keepKnown = (list, index) =>
    list.filter((value) => index.has(String(value).toLowerCase()))

  const prioritySkills = keepKnown(
    stringList(source.prioritySkills ?? source.priority_skills),
    skillIndex,
  )
  const missingKeywords = keepKnown(
    stringList(source.missingKeywords ?? source.missing_keywords),
    keywordIndex,
  )
  // These two are prose the user reads, not claims about the resume, so they are
  // bounded and escaped but not filtered against a fixed list.
  const experienceGaps = stringList(source.experienceGaps ?? source.experience_gaps)
  const suggestions = stringList(source.suggestions ?? source.recommendations)

  const hasContent =
    summary || prioritySkills.length || missingKeywords.length || experienceGaps.length || suggestions.length

  if (!hasContent) return null

  return { summary, prioritySkills, missingKeywords, experienceGaps, suggestions }
}

export default async function handler(req, res) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const token = extractBearerToken(req)
  let identity
  try {
    identity = await verifyFirebaseIdToken(token)
  } catch (err) {
    const unauthenticated = !token || /Missing ID token|Malformed ID token/.test(err.message || '')
    return res.status(401).json({
      success: false,
      error: unauthenticated
        ? 'You must be signed in to run AI skill gap analysis.'
        : 'Your session expired. Please sign in again to run AI skill gap analysis.',
    })
  }

  // Its own bucket, so gap analysis cannot starve the enhancement or parsing
  // endpoints' quota.
  const { allowed, retryAfterSeconds } = consumeRateLimit(`gap:${identity.uid}`, {
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  })
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({
      success: false,
      error: 'Too many AI analyses. Please wait a moment and try again.',
    })
  }

  const { apiKey, model, baseUrl } = getGeminiConfig()
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'AI analysis is not configured. GEMINI_API_KEY is missing.',
    })
  }

  const parsedBody = readJsonBody(req)
  if (!parsedBody.ok) {
    return res.status(400).json({ success: false, error: parsedBody.error })
  }

  const { jobDescription, analysis } = parsedBody.body

  if (typeof jobDescription !== 'string' || !jobDescription.trim()) {
    return res.status(400).json({ success: false, error: 'Missing or empty "jobDescription" field.' })
  }
  if (jobDescription.trim().length < MIN_JOB_DESCRIPTION_LENGTH) {
    return res.status(400).json({
      success: false,
      error: 'The job description is too short to analyze.',
    })
  }
  if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `The job description is too long. Only the first ${MAX_JOB_DESCRIPTION_LENGTH} characters can be analyzed.`,
    })
  }

  // The analysis block is optional from the caller's perspective but this
  // endpoint is useless without it: without the deterministic findings there is
  // nothing for the model to reason about.
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "analysis" field. Run the job match analysis first.',
    })
  }

  // Kept as named lists because they double as the allow-list the model's answer
  // is filtered against below: the model may only echo gaps that are genuinely
  // in these arrays.
  const missingSkills = stringList(analysis.missingSkills, 40)
  const missingKeywords = stringList(analysis.missingKeywords, 40)

  const analysisText = JSON.stringify({
    matchedSkills: stringList(analysis.matchedSkills, 40),
    missingSkills,
    matchedKeywords: stringList(analysis.matchedKeywords, 40),
    missingKeywords,
    experienceGaps: stringList(analysis.experienceGaps, 10),
    jobMatchScore: Number.isFinite(analysis.jobMatchScore) ? analysis.jobMatchScore : null,
  })

  // The whole job description goes in on purpose. The 20k cap above already
  // bounds it at roughly 5k tokens, far inside the model context, and truncating
  // here used to silently drop every requirement in the back half of a posting.
  const prompt = `${SYSTEM_PROMPT}\n\nJob description:\n${jobDescription.trim()}\n\nDeterministic analysis of the candidate's resume:\n${analysisText}`

  let rawResult
  try {
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          topP: 0.9,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 429) {
        return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again in a few moments.' })
      }
      if (response.status === 403) {
        return res.status(403).json({ success: false, error: 'API key is invalid or does not have permission.' })
      }
      if (response.status === 404) {
        return res.status(500).json({
          success: false,
          error: `The configured AI model "${model}" is not available for this API key. Update GEMINI_MODEL in the server environment.`,
        })
      }
      if (response.status === 503) {
        return res.status(503).json({ success: false, error: 'The AI service is busy right now. Please try again in a minute.' })
      }
      return res.status(502).json({
        success: false,
        error: `AI service error: ${(errorData && errorData.error && errorData.error.message) || response.statusText}`,
      })
    }

    const data = await response.json()
    const candidate = data.candidates && data.candidates[0]
    const parts = candidate && candidate.content && candidate.content.parts
    if (!parts || !parts.length) {
      return res.status(502).json({ success: false, error: 'AI returned an empty response. The content may have been filtered.' })
    }
    rawResult = parts.map((part) => part.text).join('').trim()
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ success: false, error: 'AI analysis request timed out.' })
    }
    if (err.cause && (err.cause.code === 'ENOTFOUND' || err.cause.code === 'ECONNREFUSED')) {
      return res.status(502).json({ success: false, error: 'Could not connect to AI service.' })
    }
    return res.status(500).json({ success: false, error: 'Internal server error while calling AI service.' })
  }

  const parsed = parseModelJson(rawResult)
  if (!parsed) {
    return res.status(502).json({ success: false, error: 'AI did not return usable JSON for this analysis.' })
  }

  const sanitized = sanitizeAnalysis(parsed, missingSkills, missingKeywords)
  if (!sanitized) {
    return res.status(502).json({ success: false, error: 'AI returned an analysis with no recognisable content.' })
  }

  return res.status(200).json({ success: true, analysis: sanitized })
}