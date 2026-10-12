import { Fragment, useState } from 'react'
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
  LogIn,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react'
import { useTheme } from '../context/useTheme'
import { useAuth } from '../context/AuthContext'
import { useIsAdmin } from '../hooks/useIsAdmin'
import templates from '../data/templates'
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

// The template count is read from the catalogue rather than typed in, so it
// cannot drift from src/data/templates.js when a template is added or removed.
// These three are product facts, not usage statistics: this project records no
// number of resumes built or users, so the row deliberately avoids claiming any.
const heroStats = [
  { value: String(templates.length), label: 'Templates' },
  { value: 'ATS', label: 'Scoring & Job Matching' },
  { value: 'Free', label: 'No Sign-Up Required' },
]

const dashboardTiles = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'Features', path: '/features', icon: Sparkles },
  { label: 'About', path: '/about', icon: Info },
  { label: 'Login', path: '/login', icon: LogIn },
  { label: 'Logout', action: 'logout', icon: LogOut },
  { label: 'Feedback', path: '/feedback', icon: MessageSquare },
  { label: 'Templates', path: '/templates', icon: LayoutTemplate },
  { label: 'Resume Vault', path: '/resume-vault', icon: FolderLock },
  {
    label: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
    description: 'Manage your ResumeBuilder preferences.',
  },
]

function Hero() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { isAdmin } = useIsAdmin()

  const welcomeName = user?.displayName || user?.email || 'Guest'

  const quickAccessTiles = [
    ...dashboardTiles,
    {
      label: 'Dashboard',
      path: isAdmin ? '/admin' : '/dashboard',
      icon: LayoutDashboard,
      description: 'View resume activity.',
    },
  ]

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
            Built for students, freshers &amp; professionals
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
            {heroStats.map((stat) => (
              <Fragment key={stat.label}>
                <div className="stat-item">
                  <span className="stat-number">{stat.value}</span>
                  <span className="stat-label">{stat.label}</span>
                </div>
                <div className="stat-divider"></div>
              </Fragment>
            ))}
          </div>
        </div>

        <section className="hero-dashboard" aria-labelledby="home-quick-access-title">
          <div className="home-dash-card">
            <div className="home-dash-header">
              <h2 className="home-dash-title" id="home-quick-access-title">
                Quick Access
              </h2>
              <p className="home-dash-welcome">Welcome, {welcomeName}</p>
            </div>

            <ul className="home-dash-grid">
              {quickAccessTiles.map(({ label, path, action, description, icon: Icon }) => {
                const content = (
                  <>
                    <span className="home-dash-tile-icon">
                      <Icon size={24} strokeWidth={1.75} />
                    </span>
                    <span className="home-dash-tile-label">{label}</span>
                  </>
                )

                if (action === 'logout') {
                  return (
                    <li key={label}>
                      <button type="button" className="home-dash-tile" onClick={handleLogout}>
                        {content}
                      </button>
                    </li>
                  )
                }

                const active = location.pathname === path
                return (
                  <li key={label}>
                    <Link
                      to={path}
                      className={`home-dash-tile ${active ? 'active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      title={description || undefined}
                    >
                      {content}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="home-dash-footer">
              <ThemeSwitcher />
              {user && (
                <div className="home-dash-footer-links">
                  <Link to={isAdmin ? '/admin' : '/dashboard'} className="home-dash-footer-link">
                    <LayoutDashboard size={15} />
                    Dashboard
                  </Link>
                  <Link to="/settings" className="home-dash-footer-link">
                    <SettingsIcon size={15} />
                    Settings
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}

export default Hero