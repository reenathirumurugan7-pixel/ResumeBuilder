import { useState } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function Login() {
  const { user, loading, login, register, resetPassword } = useAuth()
  const location = useLocation()

  const [mode, setMode] = useState('login')
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const from = location.state?.from?.pathname || '/resume-type'

  if (loading) {
    return (
      <div className="login-page auth-loading-page">
        <div className="auth-loading-page-inner">
          <span className="auth-loading-spinner"></span>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to={from} replace />
  }

  const validate = () => {
    const newErrors = {}
    if (mode === 'register') {
      if (!formData.name.trim()) {
        newErrors.name = 'Name is required'
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email'
      }
      if (!formData.password) {
        newErrors.password = 'Password is required'
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }
      if (formData.confirmPassword !== formData.password) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    } else {
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email'
      }
      if (!formData.password.trim()) {
        newErrors.password = 'Password is required'
      }
    }
    return newErrors
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    if (submitted) {
      const newErrors = { ...errors }
      delete newErrors[name]
      setErrors(newErrors)
    }
    if (formError) setFormError(null)
  }

  const switchMode = (next) => {
    setMode(next)
    setErrors({})
    setSubmitted(false)
    setFormError(null)
    setResetSent(false)
  }

  // Sends the Firebase password-reset email. Previously the link was a no-op
  // (`href="#forgot"` with preventDefault), so locked-out users had no way back in.
  const handleForgotPassword = async () => {
    const email = formData.email.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((prev) => ({ ...prev, email: 'Enter your email address first, then tap “Forgot Password?”.' }))
      setSubmitted(true)
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    setSubmitted(true)
    setFormError(null)

    if (Object.keys(validationErrors).length > 0) return

    setBusy(true)
    try {
      if (mode === 'register') {
        await register({
          email: formData.email.trim(),
          password: formData.password,
          displayName: formData.name.trim(),
        })
      } else {
        await login(formData.email.trim(), formData.password)
      }
      // On success, AuthProvider updates `user`, and the `Navigate` above
      // redirects to `from` automatically.
    } catch (error) {
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-shapes">
        <div className="login-shape login-shape-1"></div>
        <div className="login-shape login-shape-2"></div>
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <span className="login-logo-icon">RB</span>
            </div>
            <h1 className="login-title">
              {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
            </h1>
            <p className="login-subtitle">
              {mode === 'login'
                ? 'Sign in to continue building your resume'
                : 'Sign up to start building your resume'}
            </p>
          </div>

          {formError && (
            <div className="login-error" role="alert">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="login-form">
            {mode === 'register' && (
              <div className="login-field">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
            )}

            <div className="login-field">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="login-field">
              <label className="form-label">Password</label>
              <input
                type="password"
                name="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={formData.password}
                onChange={handleChange}
              />
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            {mode === 'register' && (
              <div className="login-field">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
              </div>
            )}

            {mode === 'login' ? (
              <div className="login-options">
                <span className="login-remember">
                  <span>Session stays signed in</span>
                </span>
                <button type="button" className="login-forgot" onClick={handleForgotPassword} disabled={busy}>
                  Forgot Password?
                </button>
              </div>
            ) : (
              <p className="login-terms">
                By creating an account you can save your resumes and share them with a public link.
              </p>
            )}

            {resetSent && (
              <div className="download-msg success" style={{ marginBottom: 14 }}>
                Password reset email sent. Check your inbox (and spam folder) for the link.
              </div>
            )}

            <button type="submit" className="btn btn-primary login-btn" disabled={busy || loading}>
              {busy ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="enh-spinner"></span>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : mode === 'login' ? (
                'Login'
              ) : (
                'Create Account'
              )}
            </button>

            {mode === 'login' ? (
              <>
                <div className="login-divider">
                  <span>or</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary login-create-btn"
                  onClick={() => switchMode('register')}
                  disabled={busy}
                >
                  Create Account
                </button>
              </>
            ) : (
              <p className="login-switch">
                Already have an account?{' '}
                <button
                  type="button"
                  className="login-switch-link"
                  onClick={() => switchMode('login')}
                  disabled={busy}
                >
                  Sign in
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
