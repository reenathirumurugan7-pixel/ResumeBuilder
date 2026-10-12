import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Resolves the `admin: true` custom claim from the signed ID token. The token
// is force-refreshed so a claim granted moments ago is picked up immediately
// instead of waiting out the ~1 hour token cache; if the refresh fails (e.g.
// briefly offline) the cached result is consulted as a fallback.
async function fetchAdminClaim(user) {
  try {
    const fresh = await user.getIdTokenResult(true)
    return fresh.claims && fresh.claims.admin === true
  } catch {
    try {
      const cached = await user.getIdTokenResult()
      return cached.claims && cached.claims.admin === true
    } catch {
      return false
    }
  }
}

// Navbar and the /admin guard each call useIsAdmin, so a single sign-in would
// otherwise force two identical token refreshes; removing the nested guards
// still left those two. This coalesces simultaneous reads for the same uid into
// one request. It is deliberately NOT a cache: the entry is deleted the moment
// the read settles, so any later mount (a later navigation, a re-render after
// sign-in, or an account switch) always re-verifies against Firebase and never
// reuses a stale claim.
const inflightClaims = new Map()

function readAdminClaim(user) {
  const pending = inflightClaims.get(user.uid)
  if (pending) return pending

  const promise = fetchAdminClaim(user).finally(() => {
    if (inflightClaims.get(user.uid) === promise) {
      inflightClaims.delete(user.uid)
    }
  })
  inflightClaims.set(user.uid, promise)
  return promise
}

// Shared by AdminRoute (route gating) and the Dashboard navigation, so the
// destination of the Dashboard item and the guard on /admin always agree.
// `checked` is true once the claim has been resolved at least once; `isAdmin`
// is true only when the claim was confirmed. Signed-out users and users whose
// token cannot be read are treated as non-admins and are never routed to
// /admin from the navigation.
export function useIsAdmin() {
  const { user } = useAuth()
  const [checked, setChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Track which user the resolved admin status belongs to. Whenever the
  // Firebase user reference changes (sign-out, or switching accounts), the
  // previous user's claim is dropped synchronously as a render-phase state
  // adjustment — before the UI paints the new session — so a prior admin's
  // `isAdmin === true` is never served to a different account while the new
  // token is being read. `checked` is reset too, so route guards re-verify
  // before exposing any admin UI.
  const [resolvedFor, setResolvedFor] = useState(user)
  if (resolvedFor !== user) {
    setResolvedFor(user)
    setIsAdmin(false)
    setChecked(false)
  }

  useEffect(() => {
    if (!user) return undefined

    let active = true
    readAdminClaim(user)
      .then((value) => {
        if (!active) return
        setIsAdmin(value)
        setChecked(true)
      })
      .catch(() => {
        if (!active) return
        setIsAdmin(false)
        setChecked(true)
      })
    return () => {
      active = false
    }
  }, [user])

  return { checked, isAdmin }
}