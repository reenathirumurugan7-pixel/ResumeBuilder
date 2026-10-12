import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, RefreshCw, Search, ShieldCheck, Trash2, Users } from 'lucide-react'
import {
  deleteAdminUser,
  listAdminUsers,
  setUserDisabled,
} from '../../services/adminApi'
import { firebaseConfigured } from '../../firebase'
import { formatDateTime, shortUid } from './utils'
import { AdminEmpty, AdminNote, AdminSectionHead, AdminState } from './State'
import './Admin.css'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'admin', label: 'Admins' },
]

function matchesStatus(user, status) {
  if (status === 'active') return !user.disabled
  if (status === 'disabled') return Boolean(user.disabled)
  if (status === 'admin') return Boolean(user.admin)
  return true
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState('all')
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    listAdminUsers()
      .then((docs) => {
        if (active) setUsers(Array.isArray(docs) ? docs : [])
      })
      .catch((err) => {
        if (active) setError(err && err.message ? err.message : 'We could not load the users.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function handleRetry() {
    setError(null)
    setLoading(true)
    listAdminUsers()
      .then((docs) => setUsers(Array.isArray(docs) ? docs : []))
      .catch((err) => setError(err && err.message ? err.message : 'We could not load the users.'))
      .finally(() => setLoading(false))
  }

  async function runUserAction(uid, action) {
    const target = users.find((item) => item.uid === uid)
    const label = target ? target.displayName || target.email || shortUid(uid) : shortUid(uid)
    setBusyId(uid)
    setNotice(null)
    try {
      if (action === 'disable' || action === 'enable') {
        await setUserDisabled(uid, action === 'disable')
        setUsers((prev) => prev.map((item) => (item.uid === uid ? { ...item, disabled: action === 'disable' } : item)))
        setNotice({
          tone: 'success',
          text: `${label} was ${action === 'disable' ? 'disabled' : 'enabled'}.`,
        })
      } else if (action === 'delete') {
        if (confirmId !== uid) {
          setConfirmId(uid)
          return
        }
        await deleteAdminUser(uid)
        setUsers((prev) => prev.filter((item) => item.uid !== uid))
        setConfirmId(null)
        setNotice({ tone: 'success', text: `${label} was deleted.` })
      }
    } catch (err) {
      setNotice({
        tone: 'warning',
        text: err && err.message ? err.message : 'That action could not be completed.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return users.filter((user) => {
      if (!matchesStatus(user, status)) return false
      if (!term) return true
      const name = String(user.displayName || '').toLowerCase()
      const email = String(user.email || '').toLowerCase()
      const uid = String(user.uid || '').toLowerCase()
      return name.includes(term) || email.includes(term) || uid.includes(term)
    })
  }, [users, filter, status])

  const activeCount = users.filter((user) => !user.disabled).length

  return (
    <div>
      <header className="admin-header">
        <div className="admin-header-text">
          <p className="admin-eyebrow">
            <Users size={14} /> Admin users
          </p>
          <h1 className="admin-title">Firebase Users</h1>
          <p className="admin-subtitle">
            The registered accounts for this project. This data comes from Firebase Auth through
            the server API — never from the client SDK. Passwords and tokens are never returned.
          </p>
        </div>
      </header>

      {notice && <AdminNote tone={notice.tone}>{notice.text}</AdminNote>}
      {!firebaseConfigured && (
        <AdminNote tone="warning">
          Firebase is not configured in this build, so the users API cannot be reached.
        </AdminNote>
      )}

      {error ? (
        <AdminState
          icon={Users}
          title="Users unavailable"
          text={error}
          action={
            <button className="admin-btn admin-btn-primary" type="button" onClick={handleRetry}>
              <RefreshCw size={16} /> Try again
            </button>
          }
        />
      ) : (
        <section className="admin-section" aria-labelledby="admin-users-title">
          <AdminSectionHead
            icon={Users}
            title={`Users (${filtered.length})`}
            note={users.length === filtered.length ? `${activeCount} active` : `${filtered.length} of ${users.length}`}
          >
            <div className="admin-filters">
              <div className="admin-filter">
                <Search size={16} />
                <input
                  className="admin-filter-input"
                  type="text"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Search email, name or UID"
                  aria-label="Search users"
                />
              </div>
              <select
                className="admin-filter-select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Filter users by status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </AdminSectionHead>

          {loading && users.length === 0 ? (
            <div className="admin-rows" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <div className="admin-row admin-row-skeleton" key={index} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <AdminEmpty
              text={
                users.length === 0
                  ? 'No Firebase users found yet.'
                  : 'No users match the current search and filter.'
              }
            />
          ) : (
            <div className="admin-table" role="table">
              <div className="admin-table-head admin-th-6" role="row">
                <span role="columnheader">User</span>
                <span role="columnheader">UID</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Joined</span>
                <span role="columnheader">Last sign-in</span>
                <span role="columnheader" className="admin-table-actions">
                  Actions
                </span>
              </div>
              {filtered.map((user) => (
                <div className="admin-table-row admin-th-6" role="row" key={user.uid}>
                  <span className="admin-table-name" role="cell" data-label="User">
                    {user.displayName || (user.email ? user.email.split('@')[0] : 'Unnamed user')}
                    <span className="admin-row-meta">{user.email || 'No email on record'}</span>
                    {user.admin && (
                      <span className="admin-row-uid">
                        <ShieldCheck size={12} /> Admin
                      </span>
                    )}
                  </span>
                  <span role="cell" data-label="UID" title={user.uid}>
                    {shortUid(user.uid)}
                  </span>
                  <span role="cell" data-label="Status">
                    <span className={`admin-badge ${user.disabled ? '' : 'is-public'}`}>
                      {user.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </span>
                  <span role="cell" data-label="Joined">
                    {formatDateTime(user.creationTime)}
                  </span>
                  <span role="cell" data-label="Last sign-in">
                    {formatDateTime(user.lastSignInTime)}
                  </span>
                  <span className="admin-table-actions" role="cell" data-label="Actions">
                    {!user.admin && (
                      <>
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          type="button"
                          onClick={() => runUserAction(user.uid, user.disabled ? 'enable' : 'disable')}
                          disabled={busyId === user.uid}
                        >
                          {user.disabled ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          type="button"
                          onClick={() => runUserAction(user.uid, 'delete')}
                          disabled={busyId === user.uid}
                        >
                          <Trash2 size={13} />
                          {confirmId === user.uid ? 'Confirm?' : 'Delete'}
                        </button>
                      </>
                    )}
                    {user.admin && (
                      <span className="admin-row-uid">
                        <BadgeCheck size={13} /> Protected
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
