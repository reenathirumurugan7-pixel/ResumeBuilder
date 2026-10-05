import { extractBearerToken, verifyFirebaseIdToken } from '../_lib/firebaseToken.js'
import { applyCors } from '../_lib/cors.js'
import { consumeRateLimit } from '../_lib/rateLimit.js'
import { readJsonBody } from '../_lib/body.js'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Keep this in sync with GEMINI_MODEL in .env / .env.example.
//
// Chosen by testing the exact payloads this file sends (thinkingConfig
// thinkingBudget:0 below, and the responseMimeType:application/json shape that
// parse.js sends) against the API key for this project:
//   gemini-3.5-flash        passed every call, ~1.5-1.7s
//   gemini-3.6-flash        intermittent 503 "high demand" on the parse payload
//   gemini-3.8-flash        intermittent 503 on the parse payload
//   gemini-3.5-flash-lite   HTTP 400: rejects the thinkingBudget:0 config
//   gemini-3-flash-preview  works, but is a preview id that can be retired
//   gemini-2.5-flash(-lite) HTTP 404 "no longer available to new users"
// 3.5-flash is the only non-preview model that answered both payload shapes on
// every attempt, so it is the default. GEMINI_MODEL still overrides it.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const MAX_TEXT_LENGTH = 5000
const REQUEST_TIMEOUT_MS = 25000
// Resume sections are short, so there is no reason to spend the budget on
// reasoning. Thinking is disabled explicitly and the output budget is generous
// enough that the visible text is never truncated (at 500 the model's own
// thinking consumed the whole allowance and returned partial sentences).
const MAX_OUTPUT_TOKENS = 1024
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 1000

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY
  const model = (process.env.GEMINI_MODEL || '').trim() || DEFAULT_GEMINI_MODEL
  return { apiKey, model, baseUrl: `${GEMINI_API_URL}/${model}:generateContent` }
}

const SYSTEM_PROMPTS = {
  objective:
    'You are a professional resume writer. Enhance the following career objective or professional summary for a resume. Make it concise, impactful, professional, and tailored for ATS systems. Do not use first-person pronouns. Return ONLY the enhanced text, nothing else.',
  skills:
    'You are a professional resume writer. Improve the following skills list for a resume. Format as a clean comma-separated list, remove duplicates, and suggest better phrasing. Return ONLY the improved skills list.',
  projects:
    'You are a professional resume writer. Enhance the following project description for a resume. Use strong action verbs, quantifiable results where possible, and keep it concise. Do not use first-person pronouns. Return ONLY the enhanced project description.',
  experience:
    'You are a professional resume writer. Enhance the following work experience or internship description for a resume. Use strong action verbs, quantify achievements, remove passive voice. Do not use first-person pronouns. Return ONLY the enhanced description.',
};

const TYPE_LABELS = {
  objective: 'career objective or professional summary',
  skills: 'skills list',
  projects: 'project description',
  experience: 'experience description',
};

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // -------------------------------------------------------------------------
  // Authentication. The endpoint spends the owner's Gemini budget, so an
  // anonymous caller is rejected before any key is read or any quota is spent.
  // The Gemini key itself never leaves this file.
  // -------------------------------------------------------------------------
  const token = extractBearerToken(req);
  let identity;
  try {
    identity = await verifyFirebaseIdToken(token);
  } catch (err) {
    const unauthenticated = !token || /Missing ID token|Malformed ID token/.test(err.message || '');
    return res.status(401).json({
      success: false,
      error: unauthenticated
        ? 'You must be signed in to use AI enhancements.'
        : 'Your session expired. Please sign in again to use AI enhancements.',
    });
  }

  // consumeRateLimit reports { allowed, remaining, retryAfterSeconds }. Reading a
  // non-existent `limit` field left it undefined, so `!limit` was always true and
  // every authenticated request was rejected with 429 before Gemini was called.
  const { allowed, retryAfterSeconds } = consumeRateLimit(`ai:${identity.uid}`, {
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: 'Too many AI requests. Please wait a moment and try again.',
    });
  }

  const { apiKey, model, baseUrl } = getGeminiConfig();

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'AI service is not configured. GEMINI_API_KEY is missing.',
    });
  }

  // Read after authentication and the rate limiter, so an anonymous or abusive
  // caller never reaches the parser, and a malformed body is a 400 rather than
  // the 500 Vercel's body parser would otherwise raise here.
  const parsedBody = readJsonBody(req);
  if (!parsedBody.ok) {
    return res.status(400).json({ success: false, error: parsedBody.error });
  }

  const { text, type = 'objective' } = parsedBody.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Missing or empty "text" field.',
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Text is too long. Please keep it under ${MAX_TEXT_LENGTH} characters.`,
    });
  }

  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.objective;
  const typeLabel = TYPE_LABELS[type] || 'text';

  const prompt = `${systemPrompt}\n\nOriginal ${typeLabel}:\n${text.trim()}\n\nEnhanced ${typeLabel}:`;

  try {
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          topP: 0.8,
          topK: 40,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMessage = errorData?.error?.message || response.statusText;

      if (response.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please try again in a few moments.',
        });
      }
      if (response.status === 400) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request to AI service.',
        });
      }
      if (response.status === 403) {
        return res.status(403).json({
          success: false,
          error: 'API key is invalid or does not have permission.',
        });
      }
      if (response.status === 404) {
        // Gemini returns 404 when the model id itself is gone or retired for
        // this key. Surfaced separately so the fix (update GEMINI_MODEL) is
        // obvious instead of looking like a transient outage.
        return res.status(500).json({
          success: false,
          error: `The configured AI model "${model}" is not available for this API key. Update GEMINI_MODEL in the server environment.`,
        });
      }
      if (response.status === 503) {
        return res.status(503).json({
          success: false,
          error: 'The AI service is busy right now. Please try again in a minute.',
        });
      }

      return res.status(502).json({
        success: false,
        error: `AI service error: ${errMessage}`,
      });
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts.length) {
      return res.status(502).json({
        success: false,
        error: 'AI returned an empty response. The content may have been filtered.',
      });
    }

    const result = candidate.content.parts
      .map((p) => p.text)
      .join('')
      .trim();

    if (!result) {
      return res.status(502).json({
        success: false,
        error: 'AI returned an empty response.',
      });
    }

    return res.status(200).json({ success: true, result });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'AI service request timed out.',
      });
    }
    if (err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED') {
      return res.status(502).json({
        success: false,
        error: 'Could not connect to AI service.',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Internal server error while calling AI service.',
    });
  }
}
