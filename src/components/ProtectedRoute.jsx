import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
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

  if (!user) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />
  }

  return children
}