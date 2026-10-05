// Reads the JSON request body without letting a bad request become a 500.
//
// Vercel populates `request.body` by parsing the request, and that parse throws
// when the payload is not valid JSON. The handlers used to destructure
// `req.body` directly, so a malformed body escaped as an unhandled exception and
// the client saw a generic 500 instead of the 400 its mistake deserved. The
// Express dev server never showed this because express.json() answers bad JSON
// with its own 400 before the handler runs.
//
// Returning a value instead of throwing keeps the decision in the handler, where
// the existing { success, error } shape and status codes already live. Undefined
// and null both become {} so the handlers' own "missing field" validation still
// runs and produces its usual message.

/**
 * @param {object} req Request with a possibly-throwing `body` getter.
 * @returns {{ ok: true, body: object } | { ok: false, error: string }}
 */
export function readJsonBody(req) {
  let body
  try {
    body = req.body
  } catch {
    return { ok: false, error: 'The request body is not valid JSON.' }
  }

  // No Content-Type, or one Vercel cannot parse into an object.
  if (body === undefined || body === null) return { ok: true, body: {} }

  // text/plain arrives as a string and form data as a parsed object that is not
  // the shape these endpoints expect. Both are a client error, not a server one.
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'The request body must be a JSON object.' }
  }

  return { ok: true, body }
}