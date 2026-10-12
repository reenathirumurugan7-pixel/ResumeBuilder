import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileText, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteResume, getAllResumes } from '../../services/adminFirestore'
import { firebaseConfigured } from '../../firebase'
import { isPublicResume, resumeTitle, resumeTypeOf, toCount } from '../../utils/resumeMetrics'
import templates from '../../data/templates'
import { formatDateTime, shortUid } from './utils'
import { AdminEmpty, AdminNote, AdminSectionHead, AdminState } from './State'
import './Admin.css'

function templateName(resume) {
  const templateId = resume?.config?.templateId
  if (!templateId) return 'Default layout'
  const template = templates.find((item) => item.id === templateId)
  return template?.name || 'Custom layout'
}

export default function AdminResumes() {
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    getAllResumes()
      .then((docs) => {
        if (active) setResumes(Array.isArray(docs) ? docs : [])
      })
      .catch(() => {
        if (active) setError('We could not load the resumes right now.')
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
    getAllResumes()
      .then((docs) => setResumes(Array.isArray(docs) ? docs : []))
      .catch(() => setError('We could not load the resumes right now.'))
      .finally(() => setLoading(false))
  }

  async function handleDelete(resume) {
    if (confirmId !== resume.id) {
      setConfirmId(resume.id)
      return
    }
    setBusyId(resume.id)
    setNotice(null)
    try {
      await deleteResume(resume.id)
      setResumes((prev) => prev.filter((item) => item.id !== resume.id))
    } catch {
      setNotice('That resume could not be deleted. Try again.')
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase()
    if (!term) return resumes
    return resumes.filter((resume) => {
      const name = resumeTitle(resume).toLowerCase()
      const owner = String(resume.userId || '').toLowerCase()
      return name.includes(term) || owner.includes(term)
    })
  }, [resumes, filter])

  return (
    <div>
      <header className="admin-header">
        <div className="admin-header-text">
          <p className="admin-eyebrow">
            <FileText size={14} /> Admin resumes
          </p>
          <h1 className="admin-title">All Resumes</h1>
          <p className="admin-subtitle">
            Every resume stored in Firestore, including private drafts. Deleting a resume here is
            permanent for its owner.
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
          icon={FileText}
          title="Resumes unavailable"
          text={error}
          action={
            <button className="admin-btn admin-btn-primary" type="button" onClick={handleRetry}>
              <RefreshCw size={16} /> Try again
            </button>
          }
        />
      ) : (
        <section className="admin-section" aria-labelledby="admin-resumes-title">
          <AdminSectionHead icon={FileText} title={`Resumes (${filtered.length})`} note="Live from Firestore">
            <div className="admin-filter">
              <Search size={16} />
              <input
                className="admin-filter-input"
                type="text"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by name or owner"
                aria-label="Filter resumes"
              />
            </div>
          </AdminSectionHead>

          {loading && resumes.length === 0 ? (
            <div className="admin-rows" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <div className="admin-row admin-row-skeleton" key={index} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <AdminEmpty text={resumes.length === 0 ? 'No resumes stored yet.' : `Nothing matches "${filter}".`} />
          ) : (
            <div className="admin-table" role="table">
              <div className="admin-table-head admin-th-8" role="row">
                <span role="columnheader">Resume</span>
                <span role="columnheader">Owner</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Views</span>
                <span role="columnheader">Down</span>
                <span role="columnheader">QR</span>
                <span role="columnheader">Updated</span>
                <span role="columnheader" className="admin-table-actions">
                  Actions
                </span>
              </div>
              {filtered.map((resume) => {
                const publicResume = isPublicResume(resume)
                return (
                  <div className="admin-table-row admin-th-8" role="row" key={resume.id}>
                    <span className="admin-table-name" role="cell" data-label="Resume">
                      {resumeTitle(resume)}
                      <span className="admin-row-meta">
                        {templateName(resume)} · {resumeTypeOf(resume) === 'experienced' ? 'Experienced' : 'Fresher'}
                      </span>
                    </span>
                    <span role="cell" data-label="Owner" title={resume.userId}>
                      {shortUid(resume.userId)}
                    </span>
                    <span role="cell" data-label="Status">
                      <span className={`admin-badge ${publicResume ? 'is-public' : ''}`}>
                        {publicResume ? 'Public' : 'Draft'}
                      </span>
                    </span>
                    <span role="cell" data-label="Views">
                      {toCount(resume.views)}
                    </span>
                    <span role="cell" data-label="Downloads">
                      {toCount(resume.downloads)}
                    </span>
                    <span role="cell" data-label="QR scans">
                      {toCount(resume.qrScans)}
                    </span>
                    <span role="cell" data-label="Updated">
                      {formatDateTime(resume.updatedAt)}
                    </span>
                    <span className="admin-table-actions" role="cell" data-label="Actions">
                      {publicResume && (
                        <Link
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          to={`/resume/${resume.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={13} /> View
                        </Link>
                      )}
                      <button
                        className="admin-btn admin-btn-danger admin-btn-sm"
                        type="button"
                        onClick={() => handleDelete(resume)}
                        disabled={busyId === resume.id}
                      >
                        <Trash2 size={13} />
                        {confirmId === resume.id ? 'Confirm?' : 'Delete'}
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}