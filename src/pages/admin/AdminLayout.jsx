import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './Admin.css'

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/resumes', label: 'Resumes', icon: FileText },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/admin/settings', label: 'Status', icon: ShieldCheck },
]

export default function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-layout">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-head">
              <span className="admin-sidebar-icon">
                <ShieldCheck size={20} />
              </span>
              <div className="admin-sidebar-text">
                <p className="admin-sidebar-title">Admin Console</p>
                <p className="admin-sidebar-sub">{user?.email || 'Signed in'}</p>
              </div>
            </div>
            <nav className="admin-nav" aria-label="Admin dashboard">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}
                    to={item.to}
                    end={item.end}
                    key={item.to}
                  >
                    <Icon size={17} />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>
            <div className="admin-sidebar-foot">
              <Link className="admin-back-link" to="/">
                Back to Home
              </Link>
            </div>
          </aside>
          <main className="admin-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}