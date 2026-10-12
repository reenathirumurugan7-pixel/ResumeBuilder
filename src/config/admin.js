// Constants for the admin dashboard.
//
// None of these values grant access. Every admin gate is enforced by the
// `admin: true` custom claim in the user's verified Firebase ID token
// (AdminRoute gates the UI, firestore.rules `isAdmin()` gates the data, and the
// server API re-checks the claim). These paths only tell the client where the
// server-side admin endpoints live.

export const ADMIN_API_BASE = '/api/admin'
export const ADMIN_USERS_PATH = `${ADMIN_API_BASE}/users`