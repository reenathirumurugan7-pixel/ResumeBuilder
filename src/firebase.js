import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.storageBucket &&
  firebaseConfig.appId,
)

let db = null
let auth = null

function getAppInstance() {
  if (!firebaseConfigured) {
    throw new Error(
      'Firebase is not configured. Add the VITE_FIREBASE_* environment variables to your .env file.',
    )
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getDb() {
  if (!db) {
    db = getFirestore(getAppInstance())
  }
  return db
}

export function getAuthInstance() {
  if (!auth) {
    auth = getAuth(getAppInstance())
  }
  return auth
}
