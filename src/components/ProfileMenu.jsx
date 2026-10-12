import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Settings as SettingsIcon, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './ProfileMenu.css'

// Small account avatar for the header. It reads the already-signed-in Firebase
// user and calls the same `logout` the rest of the app uses, so it adds no auth
// logic of its own. Signed-out visitors simply do not get the control.
function ProfileMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [photoBroken, setPhotoBroken] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!user) return null

  const displayName = (user.displayName && user.displayName.trim()) || ''
  const email = user.email || ''
  const label = displayName || email
  const initial = (displayName || email).charAt(0).toUpperCase()
  const showPhoto = Boolean(user.photoURL) && !photoBroken

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/')
  }

  const avatar = showPhoto ? (
    <img
      className="profile-avatar-img"
      src={user.photoURL}
      alt=""
      onError={() => setPhotoBroken(true)}
    />
  ) : initial ? (
    <span className="profile-avatar-initial">{initial}</span>
  ) : (
    <span className="profile-avatar-icon">
      <User size={18} />
    </span>
  )

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="profile-menu-btn"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label ? `Account menu for ${label}` : 'Account menu'}
        title={label || undefined}
      >
        {avatar}
      </button>

      {open && (
        <div className="profile-menu-dropdown" role="menu" aria-label="Account">
          <div className="profile-menu-identity">
            <span className="profile-menu-name">{label || 'Your account'}</span>
            {email && <span className="profile-menu-email">{email}</span>}
          </div>

          <div className="profile-menu-divider" />

          <Link
            to="/settings"
            className="profile-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="profile-menu-item-icon">
              <SettingsIcon size={16} />
            </span>
            Account settings
          </Link>

          <button
            type="button"
            className="profile-menu-item profile-menu-item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <span className="profile-menu-item-icon">
              <LogOut size={16} />
            </span>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
