import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FolderLock,
  Home as HomeIcon,
  Info,
  LayoutTemplate,
  Menu,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIsAdmin } from '../hooks/useIsAdmin'
import ProfileMenu from './ProfileMenu'
import './Navbar.css'

// Same labels and route paths the Home hero navigation already uses, so the
// global header and the landing page never disagree about where a link goes.
const baseNavLinks = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'Templates', path: '/templates', icon: LayoutTemplate },
  { label: 'Resume Vault', path: '/resume-vault', icon: FolderLock },
  { label: 'Features', path: '/features', icon: Sparkles },
  { label: 'About', path: '/about', icon: Info },
  { label: 'Feedback', path: '/feedback', icon: MessageSquare },
]

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const { isAdmin } = useIsAdmin()

  // Home already renders its own navigation inside the Hero, so the global
  // header keeps only the logo there instead of duplicating the same links.
  const showLinks = location.pathname !== '/'

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Dashboard is no longer a navbar entry (the /dashboard route and page are
  // untouched and reachable directly). In its place admins get an "Admin Panel"
  // link to /admin — still guarded by AdminRoute — and only when the existing
  // `admin === true` custom claim resolves. Normal users never see the item.
  // Resume Vault and Feedback keep their existing behaviour: the vault is still
  // guarded by ProtectedRoute when signed out.
  const navLinks = user && isAdmin
    ? [...baseNavLinks, { label: 'Admin Panel', path: '/admin', icon: ShieldCheck }]
    : baseNavLinks

  // Non-home pages sit on dark hero/section gradients, so the header gets a
  // solid glass bar there even before scrolling to keep the links readable.
  const pinned = scrolled || showLinks

  return (
    <nav className={`navbar ${pinned ? 'scrolled' : ''}`} aria-label="Global navigation">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">RB</span>
          <span className="logo-text">ResumeBuilder</span>
        </Link>

        {/* The account/avatar control lives beside the existing links so the
            header keeps one single right-hand control cluster (logo left,
            navigation + account right) on every page. */}
        <div className="navbar-actions">
          {showLinks && (
            <>
              <button
                type="button"
                className="navbar-toggle"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="navbar-menu"
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>

              <ul className={`navbar-links ${menuOpen ? 'open' : ''}`} id="navbar-menu">
                {navLinks.map(({ label, path, icon: Icon }) => {
                  const active = location.pathname === path
                  return (
                    <li key={path}>
                      <Link
                        to={path}
                        className={`navbar-link ${active ? 'active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="navbar-link-icon"><Icon size={16} /></span>
                        <span className="navbar-link-label">{label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <ProfileMenu />
        </div>
      </div>
    </nav>
  )
}

export default Navbar