import { extractBearerToken, verifyFirebaseIdToken } from '../_lib/firebaseToken.js'
import { applyCors } from '../_lib/cors.js'
import { consumeRateLimit } from '../_lib/rateLimit.js'
import { readJsonBody } from '../_lib/body.js'

// Structured resume parsing. This is deliberately a separate endpoint from
// /api/ai/enhance: it takes the raw text of an uploaded PDF/DOCX, asks Gemini
// for a schema-shaped JSON resume, and re-validates that answer here before it
// is allowed anywhere near the client. Nothing in enhance.js is touched.
//
// The Gemini key never leaves this file, the caller must present a valid
// Firebase ID token, and the request is rate limited on its own bucket so a
// parsing loop cannot starve the enhancement endpoint's budget.

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Keep in sync with GEMINI_MODEL in .env / .env.example.
// gemini-3.5-flash was verified against the responseMimeType:application/json
// payload below; see enhance.js for the full model comparison and why the
// flash-lite and 3.6/3.8 variants are not used.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const MIN_TEXT_LENGTH = 40
const MAX_TEXT_LENGTH = 20000
const MAX_OUTPUT_TOKENS = 4096
const REQUEST_TIMEOUT_MS = 30000
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

// Caps applied to whatever the model returns. A resume never has 200 projects.
const CAPS = {
  education: 20,
  skills: 80,
  languages: 20,
  projects: 30,
  workExperience: 30,
  internship: 30,
  certifications: 40,
  achievements: 40,
  short: 200,
  text: 4000,
}

function text(value, max = CAPS.short) {
  if (typeof value === 'string') return value.trim().slice(0, max)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function unique(values) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    const clean = value.trim()
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clean)
    if (out.length >= 80) break
  }
  return out
}

const SYSTEM_PROMPT = [
  'You convert the plain text of a resume into JSON. Reply with JSON only - no prose, no markdown fences.',
  'Use this exact shape:',
  '{',
  '  "personalInfo": { "fullName": string, "email": string, "phone": string, "location": string, "linkedin": string, "github": string, "portfolio": string },',
  '  "professionalSummary": string,',
  '  "careerObjective": string,',
  '  "education": [ { "degree": string, "department": string, "college": string, "university": string, "startYear": string, "endYear": string, "cgpa": string } ],',
  '  "skills": [ string ],',
  '  "languages": [ { "name": string, "proficiency": string } ],',
  '  "projects": [ { "title": string, "technologies": string, "description": string, "link": string } ],',
  '  "workExperience": [ { "company": string, "jobTitle": string, "location": string, "startDate": string, "endDate": string, "responsibilities": string } ],',
  '  "internship": [ { "company": string, "role": string, "duration": string, "description": string } ],',
  '  "certifications": [ { "name": string } ],',
  '  "achievements": [ { "name": string } ]',
  '}',
  'Rules:',
  '- Copy values exactly as they appear in the resume. Never invent facts, employers, dates or skills.',
  '- Use an empty string, an empty array or null for anything the resume does not state.',
  '- Every list must be a list of objects (except skills, which is a list of strings).',
  '- professionalSummary is for experienced candidates, careerObjective is for students and freshers.',
  '- Put internships in the internship list and paid roles in workExperience.',
  '- Keep descriptions as plain text; collapse line breaks into spaces.',
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

// Turns whatever the model produced into the exact resume schema. Every list
// field is rebuilt from scratch, so a string where an array belongs can never
// survive this function.
function sanitizeParsedResume(raw, resumeType) {
  const source = asObject(raw)
  const info = asObject(source.personalInfo)

  const personalInfo = {
    fullName: text(info.fullName || info.name, 120),
    email: text(info.email, 160),
    phone: text(info.phone, 40),
    location: text(info.location, 120),
    linkedin: text(info.linkedin, 200),
    github: text(info.github, 200),
    portfolio: text(info.portfolio, 200),
  }

  const education = asArray(source.education).slice(0, CAPS.education).map((item) => {
    const entry = asObject(item)
    return {
      degree: text(entry.degree),
      department: text(entry.department),
      college: text(entry.college),
      university: text(entry.university),
      startYear: text(entry.startYear, 20),
      endYear: text(entry.endYear, 20),
      cgpa: text(entry.cgpa, 40),
    }
  }).filter((entry) => entry.degree || entry.college || entry.university || entry.endYear)

  const skills = unique(
    asArray(source.skills)
      .map((item) => (typeof item === 'string' ? item : text(asObject(item).name ?? asObject(item).skill)))
      .filter(Boolean),
  ).slice(0, CAPS.skills)

  const languages = asArray(source.languages).slice(0, CAPS.languages).map((item) => {
    const entry = asObject(item)
    if (typeof item === 'string') return { name: text(item), proficiency: '' }
    return { name: text(entry.name), proficiency: text(entry.proficiency, 60) }
  }).filter((entry) => entry.name)

  const projects = asArray(source.projects).slice(0, CAPS.projects).map((item) => {
    const entry = asObject(item)
    return {
      title: text(entry.title),
      technologies: text(entry.technologies),
      description: text(entry.description, CAPS.text),
      link: text(entry.link, 300),
    }
  }).filter((entry) => entry.title || entry.description)

  const workExperience = asArray(source.workExperience).slice(0, CAPS.workExperience).map((item) => {
    const entry = asObject(item)
    return {
      company: text(entry.company),
      jobTitle: text(entry.jobTitle || entry.role || entry.position),
      location: text(entry.location),
      startDate: text(entry.startDate, 40),
      endDate: text(entry.endDate, 40),
      responsibilities: text(entry.responsibilities || entry.description, CAPS.text),
    }
  }).filter((entry) => entry.company || entry.jobTitle || entry.responsibilities)

  const internship = asArray(source.internship).slice(0, CAPS.internship).map((item) => {
    const entry = asObject(item)
    return {
      company: text(entry.company),
      role: text(entry.role || entry.jobTitle),
      duration: text(entry.duration, 60),
      description: text(entry.description, CAPS.text),
    }
  }).filter((entry) => entry.company || entry.role || entry.description)

  const nameOnly = (key) => asArray(source[key]).slice(0, CAPS[key]).map((item) => {
    if (typeof item === 'string') return { name: text(item, CAPS.text) }
    return { name: text(asObject(item).name || asObject(item).title, CAPS.text) }
  }).filter((entry) => entry.name)

  const summary = text(source.professionalSummary || source.summary, CAPS.text)
  const objective = text(source.careerObjective || source.objective, CAPS.text)

  const formData = {
    personalInfo,
    careerObjective: resumeType === 'fresher' ? objective || summary : '',
    professionalSummary: resumeType === 'experienced' ? summary || objective : '',
    education,
    skills,
    languages,
    projects,
    certifications: nameOnly('certifications'),
    achievements: nameOnly('achievements'),
    internship,
    workExperience,
  }

  const hasContent =
    personalInfo.fullName ||
    personalInfo.email ||
    education.length ||
    skills.length ||
    projects.length ||
    workExperience.length ||
    internship.length

  return hasContent ? formData : null
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
        ? 'You must be signed in to import a resume with AI.'
        : 'Your session expired. Please sign in again to import a resume with AI.',
    })
  }

  // Its own bucket, so parsing cannot eat the enhancement endpoint's quota.
  const { allowed, retryAfterSeconds } = consumeRateLimit(`parse:${identity.uid}`, {
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  })
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({
      success: false,
      error: 'Too many resume imports. Please wait a moment and try again.',
    })
  }

  const { apiKey, model, baseUrl } = getGeminiConfig()
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'AI parsing is not configured. GEMINI_API_KEY is missing.',
    })
  }

  // Read after authentication and the rate limiter, so an anonymous or abusive
  // caller never reaches the parser, and a malformed body is a 400 rather than
  // the 500 Vercel's body parser would otherwise raise here.
  const parsedBody = readJsonBody(req)
  if (!parsedBody.ok) {
    return res.status(400).json({ success: false, error: parsedBody.error })
  }

  const { text: resumeText, resumeType = 'fresher' } = parsedBody.body
  const type = resumeType === 'experienced' ? 'experienced' : 'fresher'

  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    return res.status(400).json({ success: false, error: 'Missing or empty "text" field.' })
  }
  if (resumeText.trim().length < MIN_TEXT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: 'The extracted text is too short to parse as a resume.',
    })
  }
  if (resumeText.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `The extracted text is too long. Only the first ${MAX_TEXT_LENGTH} characters can be parsed.`,
    })
  }

  const prompt = `${SYSTEM_PROMPT}\n\nThe candidate is treated as a "${type}" resume.\n\nResume text:\n${resumeText.trim()}`

  let rawResult
  try {
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          topP: 0.8,
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
      return res.status(504).json({ success: false, error: 'AI parsing request timed out.' })
    }
    if (err.cause && (err.cause.code === 'ENOTFOUND' || err.cause.code === 'ECONNREFUSED')) {
      return res.status(502).json({ success: false, error: 'Could not connect to AI service.' })
    }
    return res.status(500).json({ success: false, error: 'Internal server error while calling AI service.' })
  }

  const parsed = parseModelJson(rawResult)
  if (!parsed) {
    return res.status(502).json({ success: false, error: 'AI did not return usable JSON for this resume.' })
  }

  const formData = sanitizeParsedResume(parsed, type)
  if (!formData) {
    return res.status(502).json({ success: false, error: 'AI returned a resume with no recognisable content.' })
  }

  return res.status(200).json({ success: true, formData })
}