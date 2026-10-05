import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FileText,
  CheckCircle,
  Sparkles,
  Home as HomeIcon,
  LayoutTemplate,
  FolderLock,
  Info,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react'
import { useTheme } from '../context/useTheme'
import { useAuth } from '../context/AuthContext'
import './Hero.css'

const themeOptions = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const current = themeOptions.find((o) => o.id === theme) || themeOptions[2]
  const CurrentIcon = current.icon

  return (
    <div className={`theme-switcher ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="theme-switcher-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
      >
        <span className="theme-switcher-icon"><CurrentIcon size={16} /></span>
        <span className="theme-switcher-text">{current.label} Theme</span>
        <span className="theme-switcher-caret">▾</span>
      </button>
      {open && (
        <ul className="theme-switcher-menu" role="listbox" aria-label="Theme options">
          {themeOptions.map((opt) => {
            const Icon = opt.icon
            return (
              <li key={opt.id} role="option" aria-selected={theme === opt.id}>
                <button
                  type="button"
                  className={`theme-option ${theme === opt.id ? 'active' : ''}`}
                  onClick={() => { setTheme(opt.id); setOpen(false) }}
                >
                  <span className="theme-option-icon"><Icon size={15} /></span>
                  <span>{opt.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const heroFeatures = [
  'ATS-Friendly Resumes',
  'AI Resume Enhancement',
  'Professional Templates',
  'Live Preview',
]

const baseNavLinks = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'Templates', path: '/templates', icon: LayoutTemplate },
  { label: 'Resume Vault', path: '/resume-vault', icon: FolderLock },
  { label: 'Features', path: '/features', icon: Sparkles },
  { label: 'About', path: '/about', icon: Info },
  { label: 'Feedback', path: '/feedback', icon: MessageSquare },
]

function Hero() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // Dashboard and Settings are signed-in only: both sit behind ProtectedRoute,
  // so they belong with the account items below the public links. Without the
  // Dashboard entry the panel was the only nav on the page and a signed-in user
  // had no route to their own dashboard.
  const navLinks = user
    ? [
        ...baseNavLinks,
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Settings', path: '/settings', icon: SettingsIcon },
      ]
    : baseNavLinks

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <section className="hero-section">
      <div className="hero-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="container hero-container">
        <div className="hero-content">
          <p className="hero-welcome">Welcome to ResumeBuilder</p>

          <div className="hero-badge">
            <span className="badge-dot"></span>
            Trusted by 10,000+ students &amp; professionals
          </div>

          <h1 className="hero-heading">
            Build a Resume That
            <span className="hero-heading-highlight"> Gets You Noticed</span>
          </h1>

          <p className="hero-description">
            Create a professional, ATS-friendly resume with modern templates, live preview,
            AI-powered enhancement, and easy PDF or Word export.
          </p>

          <h2 className="hero-subhead">Everything You Need for Your Resume</h2>

          <ul className="hero-features">
            {heroFeatures.map((feature) => (
              <li className="hero-feature" key={feature}>
                <CheckCircle size={16} />
                {feature}
              </li>
            ))}
          </ul>

          <div className="hero-buttons">
            <Link to="/resume-type" className="btn btn-primary hero-btn-primary">
              <FileText size={20} />
              Create Resume
            </Link>
            <Link to="/enhance" aria-label="Enhance Resume" className="btn btn-secondary hero-btn-secondary">
              <Sparkles size={20} />
              Enhance Resume
            </Link>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">50+</span>
              <span className="stat-label">Templates</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">10K+</span>
              <span className="stat-label">Resumes Created</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">95%</span>
              <span className="stat-label">ATS Score</span>
            </div>
          </div>
        </div>

        <nav className="hero-nav" aria-label="Main navigation">
          {!user && (
            <Link to="/login" className="hero-nav-login">
              Login
            </Link>
          )}

          <ul className="hero-nav-list">
            {navLinks.map(({ label, path, icon: Icon }) => (
              <li key={path}>
                <Link
                  to={path}
                  className={`hero-nav-link ${location.pathname === path ? 'active' : ''}`}
                >
                  <span className="hero-nav-icon">
                    <Icon size={17} />
                  </span>
                  <span className="hero-nav-label">{label}</span>
                </Link>
              </li>
            ))}
          </ul>

          {user && (
            <div className="hero-nav-user" title={user.email || user.displayName || 'Signed in'}>
              <span className="hero-nav-avatar">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </span>
              <span className="hero-nav-user-name">
                {user.displayName || user.email || 'Account'}
              </span>
            </div>
          )}

          {user && (
            <button type="button" className="hero-nav-logout" onClick={handleLogout}>
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          )}

          <ThemeSwitcher />
        </nav>
      </div>
    </section>
  )
}

export default Hero