// Initialises the Firebase Admin SDK for server-side admin operations.
//
// Listing, disabling and deleting Firebase Auth users cannot be done with the
// browser SDK, so the admin API uses firebase-admin with a service-account
// credential. The credential is supplied through environment variables and
// never reaches the browser:
//   - FIREBASE_SERVICE_ACCOUNT: the service account JSON (or its base64 form)
//   - FIREBASE_SERVICE_ACCOUNT_PATH: path to a service account JSON file
//   - otherwise the SDK falls back to Application Default Credentials
//     (GOOGLE_APPLICATION_CREDENTIALS locally, workload identity in the cloud)

import { readFileSync } from 'node:fs'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

let adminApp = null

function resolveProjectId() {
  const explicit = process.env.FIREBASE_PROJECT_ID
  if (explicit && explicit.trim()) return explicit.trim()
  const fromClient = process.env.VITE_FIREBASE_PROJECT_ID
  return fromClient && fromClient.trim() ? fromClient.trim() : undefined
}

function parseServiceAccount(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // Not plain JSON — try the base64 form.
  }
  try {
    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

// Errors raised here carry a stable `code` and a generic message so the API
// layer can map them to a safe response. The detailed cause is kept on
// `error.cause` for server-side debugging only: it may contain a filesystem path
// (readFileSync) or raw SDK output and must never be returned to a client.
function adminError(code, message, cause) {
  const error = new Error(message)
  error.code = code
  error.cause = cause
  return error
}

function initAdminApp(credentialFactory, projectId, code) {
  try {
    adminApp = initializeApp({ credential: credentialFactory(), projectId })
    return getAuth(adminApp)
  } catch (error) {
    throw adminError(code, 'Failed to initialise the Firebase Admin SDK.', error)
  }
}

export function getAdminAuth() {
  if (adminApp) return getAuth(adminApp)

  const account = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (account) {
    return initAdminApp(
      () => cert(account),
      account.project_id || resolveProjectId(),
      'ADMIN_CREDENTIAL_INVALID',
    )
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (path && path.trim()) {
    let fromFile
    try {
      fromFile = JSON.parse(readFileSync(path.trim(), 'utf8'))
    } catch (error) {
      throw adminError(
        'ADMIN_CREDENTIAL_UNREADABLE',
        'Could not read the configured service account file.',
        error,
      )
    }
    return initAdminApp(
      () => cert(fromFile),
      fromFile.project_id || resolveProjectId(),
      'ADMIN_CREDENTIAL_INVALID',
    )
  }

  if (getApps().length) {
    return getAuth()
  }

  return initAdminApp(() => applicationDefault(), resolveProjectId(), 'ADMIN_CREDENTIAL_MISSING')
}