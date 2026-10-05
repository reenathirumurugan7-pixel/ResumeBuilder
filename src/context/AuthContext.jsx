import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { getAuthInstance, firebaseConfigured } from '../firebase'

const AuthContext = createContext(null)

function mapAuthError(error) {
  if (!error || !error.code) return 'Something went wrong. Please try again.'
  switch (error.code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.'
    case 'auth/user-not-found':
      return 'No account found with this email.'
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.'
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.'
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.'
    case 'auth/missing-password':
      return 'Please enter a password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    case 'auth/missing-email':
      return 'Please enter your email address.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/internal-error':
      return 'An unexpected error occurred. Please try again.'
    default:
      return 'Unable to complete this action. Please try again.'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // When Firebase is configured we must wait for onAuthStateChanged to report
  // the persisted session before protected routes can decide to redirect, so
  // loading starts true. When it is *not* configured there is no session to
  // wait for, so loading settles immediately (Firebase is unusable anyway and
  // guarded routes render a "not configured" notice).
  const [loading, setLoading] = useState(() => Boolean(firebaseConfigured))

  useEffect(() => {
    if (!firebaseConfigured) return undefined
    const auth = getAuthInstance()
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const login = useCallback(async (email, password) => {
    if (!firebaseConfigured) {
      throw new Error('Firebase is not configured.')
    }
    try {
      const auth = getAuthInstance()
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential.user
    } catch (error) {
      throw new Error(mapAuthError(error), { cause: error })
    }
  }, [])

  const register = useCallback(async ({ email, password, displayName }) => {
    if (!firebaseConfigured) {
      throw new Error('Firebase is not configured.')
    }
    try {
      const auth = getAuthInstance()
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName })
      }
      return userCredential.user
    } catch (error) {
      throw new Error(mapAuthError(error), { cause: error })
    }
  }, [])

  const logout = useCallback(async () => {
    if (!firebaseConfigured) return
    try {
      await signOut(getAuthInstance())
    } catch {
      // Ignore logout errors; auth state will be cleared by onAuthStateChanged.
    }
  }, [])

  // Powers the "Forgot password" flow on the login screen. Firebase emails a
  // reset link; the user lands back on the app and signs in with the new one.
  const resetPassword = useCallback(async (email) => {
    if (!firebaseConfigured) {
      throw new Error('Firebase is not configured.')
    }
    try {
      await sendPasswordResetEmail(getAuthInstance(), email)
    } catch (error) {
      throw new Error(mapAuthError(error), { cause: error })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
