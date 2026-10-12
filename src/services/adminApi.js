import { getAuthInstance, firebaseConfigured } from '../firebase'
import { ADMIN_USERS_PATH } from '../config/admin'

// Client for the server-side admin API. Every endpoint is re-verified server
// side with the signed ID token and the `admin: true` claim, so these calls can
// never succeed for a non-admin even if something renders this UI by mistake.

async function currentToken() {
  if (!firebaseConfigured) {
    throw new Error('Firebase is not configured.')
  }
  const auth = getAuthInstance()
  if (!auth.currentUser) {
    throw new Error('You must be signed in to use the admin tools.')
  }
  return auth.currentUser.getIdToken()
}

async function request(endpoint, options = {}) {
  const token = await currentToken()
  const response = await fetch(endpoint, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const serverError = payload && typeof payload.error === 'string' ? payload.error : null
  if (!response.ok) {
    throw new Error(serverError || `The admin service failed (HTTP ${response.status}).`)
  }
  return payload
}

export async function listAdminUsers() {
  const data = await request(ADMIN_USERS_PATH)
  return data.users || []
}

export async function setUserDisabled(uid, disabled) {
  return request(ADMIN_USERS_PATH, {
    method: 'POST',
    body: { action: disabled ? 'disable' : 'enable', uid },
  })
}

export async function deleteAdminUser(uid) {
  return request(ADMIN_USERS_PATH, {
    method: 'POST',
    body: { action: 'delete', uid },
  })
}