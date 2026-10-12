import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, RefreshCw, Search, Trash2 } from 'lucide-react'
import { deleteFeedback, getAllFeedback } from '../../services/adminFirestore'
import { firebaseConfigured } from '../../firebase'
import { formatDateTime, shortUid } from './utils'
import { AdminEmpty, AdminNote, AdminSectionHead, AdminState } from './State'
import './Admin.css'

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    getAllFeedback()
      .then((docs) => {
        if (active) setFeedback(Array.isArray(docs) ? docs : [])
      })
      .catch(() => {
        if (active) setError('We could not load the feedback right now.')
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
    getAllFeedback()
      .then((docs) => setFeedback(Array.isArray(docs) ? docs : []))
      .catch(() => setError('We could not load the feedback right now.'))
      .finally(() => setLoading(false))
  }

  async function handleDelete(item) {
    if (confirmId !== item.id) {
      setConfirmId(item.id)
      return
    }
    setBusyId(item.id)
    setNotice(null)
    try {
      await deleteFeedback(item.id)
      setFeedback((prev) => prev.filter((entry) => entry.id !== item.id))
    } catch {
      setNotice('That message could not be deleted. Try again.')
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase()
    if (!term) return feedback
    return feedback.filter((item) => {
      const message = String(item.message || '').toLowerCase()
      const name = String(item.name || '').toLowerCase()
      return message.includes(term) || name.includes(term)
    })
  }, [feedback, filter])

  return (
    <div>
      <header className="admin-header">
        <div className="admin-header-text">
          <p className="admin-eyebrow">
            <MessageSquare size={14} /> Admin feedback
          </p>
          <h1 className="admin-title">Feedback Inbox</h1>
          <p className="admin-subtitle">
            Submissions from the public feedback page. Deleting a message removes it permanently.
          </p>
        </div>
      </header>

      {notice && <AdminNote tone="warning">{notice}</AdminNote>}
      {!firebaseConfigured && (
        <AdminNote tone="warning">
          Firebase is not configured in this build, so no cloud data will load.
        </AdminNote>
      )}

      {error ? (
        <AdminState
          icon={MessageSquare}
          title="Feedback unavailable"
          text={error}
          action={
            <button className="admin-btn admin-btn-primary" type="button" onClick={handleRetry}>
              <RefreshCw size={16} /> Try again
            </button>
          }
        />
      ) : (
        <section className="admin-section" aria-labelledby="admin-feedback-title">
          <AdminSectionHead icon={MessageSquare} title={`Feedback (${filtered.length})`} note="Newest first">
            <div className="admin-filter">
              <Search size={16} />
              <input
                className="admin-filter-input"
                type="text"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by message or name"
                aria-label="Filter feedback"
              />
            </div>
          </AdminSectionHead>

          {loading && feedback.length === 0 ? (
            <div className="admin-rows" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <div className="admin-row admin-row-skeleton" key={index} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <AdminEmpty text={feedback.length === 0 ? 'No feedback submitted yet.' : `Nothing matches "${filter}".`} />
          ) : (
            <div className="admin-rows">
              {filtered.map((item) => (
                <article className="admin-row admin-feedback-row" key={item.id}>
                  <span className="admin-row-icon">
                    <MessageSquare size={16} />
                  </span>
                  <div className="admin-row-main">
                    <div className="admin-row-head">
                      <p className="admin-row-name">{item.name || 'Anonymous'}</p>
                      <span className="admin-row-uid">
                        {item.userId ? shortUid(item.userId) : 'Guest'}
                      </span>
                      <span className="admin-row-uid">{formatDateTime(item.createdAt)}</span>
                    </div>
                    {item.path && <p className="admin-row-meta">From /{String(item.path).replace(/^\//, '')}</p>}
                    <p className="admin-row-snippet">{item.message}</p>
                  </div>
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={busyId === item.id}
                  >
                    <Trash2 size={13} />
                    {confirmId === item.id ? 'Confirm?' : 'Delete'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}