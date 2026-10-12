import { AlertCircle, CheckCircle2, Inbox } from 'lucide-react'

export function AdminState({ icon: Icon, title, text, action }) {
  return (
    <div className="admin-state">
      <span className="admin-state-icon">
        <Icon size={26} />
      </span>
      <h2 className="admin-state-title">{title}</h2>
      {text && <p className="admin-state-text">{text}</p>}
      {action}
    </div>
  )
}

export function AdminEmpty({ icon: Icon = Inbox, text }) {
  return (
    <div className="admin-empty">
      <Icon size={20} />
      <p>{text}</p>
    </div>
  )
}

export function AdminNote({ tone = 'warning', children }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div className={`admin-note admin-note-${tone}`}>
      <Icon size={16} />
      <span>{children}</span>
    </div>
  )
}

export function AdminStat({ label, value, hint, tone = 'blue', icon: Icon }) {
  return (
    <article className="admin-stat">
      <span className={`admin-stat-icon admin-tone-${tone}`}>
        <Icon size={18} />
      </span>
      <div className="admin-stat-body">
        <p className="admin-stat-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="admin-stat-label">{label}</p>
        {hint && <p className="admin-stat-hint">{hint}</p>}
      </div>
    </article>
  )
}

export function AdminSectionHead({ icon: Icon, title, note, children }) {
  return (
    <div className="admin-section-head">
      <h2 className="admin-section-title">
        {Icon && <Icon size={18} />}
        {title}
      </h2>
      {note && <span className="admin-section-note">{note}</span>}
      {children}
    </div>
  )
}

export function AdminPanel({ children, className = '' }) {
  return <div className={`admin-panel${className ? ` ${className}` : ''}`}>{children}</div>
}