import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsAdmin } from '../hooks/useIsAdmin'

function AdminLoading() {
  return (
    <div
      className="auth-loading"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <span
        className="auth-loading-bar"
        style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(37, 99, 235, 0.2)',
          borderTopColor: 'var(--primary-light)',
          borderRadius: '50%',
          animation: 'authSpin 0.8s linear infinite',
        }}
      ></span>
    </div>
  )
}

// Composes the auth guard with an admin-claim check. The React side only hides
// the UI; security comes from firestore.rules and the server API, which re-check
// the claim independently. Signing in alone is not enough — a claim must have
// been granted by an Admin SDK process (see scripts/set-admin.js).
export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const { checked, isAdmin } = useIsAdmin()

  if (loading) return <AdminLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: window.location.pathname }} />
  if (!checked) return <AdminLoading />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return children
}