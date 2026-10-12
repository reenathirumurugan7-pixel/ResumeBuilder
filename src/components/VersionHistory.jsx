import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, Clock, Eye, Layers, RefreshCw, RotateCcw, Trash2, TriangleAlert, X, XCircle } from 'lucide-react'
import LiveResumePreview from './LiveResumePreview'
import { findTemplate } from '../config/customize'
import { firebaseConfigured } from '../firebase'
import {
  createResumeVersion,
  deleteResumeVersion,
  getResumeVersion,
  isVersionHistoryAvailable,
  listResumeVersions,
  sanitizeVersionSnapshot,
  versionErrorCode,
} from '../services/resumeVersions'
import './VersionHistory.css'

function formatDate(ms) {
  if (!ms) return 'Unknown'
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function typeLabel(resumeType) {
  return resumeType === 'experienced' ? 'Experienced' : 'Fresher'
}

function templateNameOf(snapshot) {
  const config = snapshot && snapshot.config
  if (!config || !config.templateId) return null
  const template = findTemplate(config.templateId)
  return template ? template.name : null
}

function versionErrorMessage(error, fallback) {
  switch (versionErrorCode(error)) {
    case 'missing-resume':
      return 'Open a resume before managing its versions.'
    case 'not-configured':
      return 'Firebase is not configured, so versions cannot be saved.'
    case 'signed-out':
      return 'You must be logged in to manage versions.'
    case 'bad-snapshot':
      return 'There is no resume data to save as a version yet.'
    case 'permission-denied':
      return 'You do not have access to this resume’s versions. If the resume is new, press “Save Resume” first; otherwise it may have been deleted or belong to another account.'
    case 'not-found':
      return 'This version is no longer available.'
    case 'offline':
    case 'unavailable':
    case 'failed-precondition':
      return 'You appear to be offline. Check your connection and try again.'
    default:
      break
  }
  if (!versionErrorCode(error) && error && error.message) return error.message
  return fallback
}

/**
 * Modal that lists every saved version of the current resume, newest first,
 * with read-only viewing, restore and delete. It never writes to the resume
 * itself: restoring simply hands the stored snapshot back to the editor, which
 * saves it through its existing save/autosave flow.
 */
export default function VersionHistory({ resumeId, resumeType, onRestore, onClose }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [blocked, setBlocked] = useState(null)
  const [notice, setNotice] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const aliveRef = useRef(true)
  // Incremented for every load; a response that comes back for a superseded
  // request (resumeId changed, unmount, manual retry) is dropped instead of
  // overwriting newer state.
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = (loadSeq.current += 1)
    if (!resumeId) {
      setVersions([])
      setBlocked(null)
      setError('This resume is not available, so its version history cannot be loaded.')
      setLoading(false)
      return
    }
    // Versions live in the owner's account, so without one the query below
    // would only come back as a permission error — explain it instead.
    if (!isVersionHistoryAvailable()) {
      setVersions([])
      setError(null)
      setBlocked(
        firebaseConfigured
          ? 'Sign in to see the versions saved to this resume.'
          : 'Firebase is not configured, so version history is unavailable.',
      )
      setLoading(false)
      return
    }
    setBlocked(null)
    setLoading(true)
    setError(null)
    try {
      const list = await listResumeVersions(resumeId)
      if (seq !== loadSeq.current || !aliveRef.current) return
      setVersions(list)
    } catch (err) {
      if (seq !== loadSeq.current || !aliveRef.current) return
      setVersions([])
      setError(versionErrorMessage(err, 'Unable to load your saved versions. Please check your connection and try again.'))
    } finally {
      if (seq === loadSeq.current && aliveRef.current) setLoading(false)
    }
  }, [resumeId])

  useEffect(() => {
    aliveRef.current = true
    // Deferred so the loading state is not written synchronously from inside
    // the effect; cancelling the timer covers an immediate unmount.
    const timer = setTimeout(() => load(), 0)
    return () => {
      aliveRef.current = false
      loadSeq.current += 1
      clearTimeout(timer)
    }
  }, [load])

  const dismissTop = useCallback(() => {
    if (busy) return
    if (confirm) setConfirm(null)
    else if (viewing) setViewing(null)
    else onClose()
  }, [busy, confirm, viewing, onClose])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismissTop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismissTop])

  const previewConfig = useMemo(() => {
    if (!viewing) return null
    const config = viewing.data.config || {}
    const template = config.templateId ? findTemplate(config.templateId) : null
    return { ...config, name: template ? template.name : 'Template' }
  }, [viewing])

  const openView = async (version) => {
    setNotice(null)
    try {
      const fresh = await getResumeVersion(resumeId, version.id)
      if (!fresh) {
        setNotice('This version is no longer available.')
        await load()
        return
      }
      const clean = sanitizeVersionSnapshot(fresh.snapshot)
      if (!clean) {
        setNotice('This version could not be opened because its saved data is missing.')
        return
      }
      setViewing({ version: fresh, data: clean })
    } catch (err) {
      setNotice(versionErrorMessage(err, 'Could not open this version.'))
    }
  }

  const confirmRestore = async () => {
    if (!confirm) return
    setBusy(true)
    setNotice(null)
    try {
      const fresh = await getResumeVersion(resumeId, confirm.version.id)
      if (!fresh) {
        setNotice('This version is no longer available.')
        setConfirm(null)
        await load()
        return
      }
      const clean = sanitizeVersionSnapshot(fresh.snapshot)
      if (!clean) throw new Error('This version could not be restored because its saved data is missing.')
      await onRestore(clean)
      setConfirm(null)
      onClose()
    } catch (err) {
      setNotice(versionErrorMessage(err, 'Could not restore this version.'))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!confirm) return
    setBusy(true)
    setNotice(null)
    try {
      await deleteResumeVersion(resumeId, confirm.version.id)
      setConfirm(null)
      await load()
    } catch (err) {
      setNotice(versionErrorMessage(err, 'Could not delete this version.'))
    } finally {
      setBusy(false)
    }
  }

  const renderList = () => {
    if (loading) {
      return (
        <div className="vh-state">
          <span className="vh-spinner" aria-hidden="true" />
          <p className="vh-state-text">Loading your saved versions…</p>
        </div>
      )
    }
    if (blocked) {
      return (
        <div className="vh-state">
          <span className="vh-state-icon"><Clock size={24} /></span>
          <h4 className="vh-state-title">Version history needs your account</h4>
          <p className="vh-state-text">{blocked}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw size={15} /> Try Again
          </button>
        </div>
      )
    }
    if (error) {
      return (
        <div className="vh-state vh-state-error">
          <span className="vh-state-icon"><TriangleAlert size={24} /></span>
          <h4 className="vh-state-title">Could not load version history</h4>
          <p className="vh-state-text">{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw size={15} /> Try Again
          </button>
        </div>
      )
    }
    if (versions.length === 0) {
      return (
        <div className="vh-state">
          <span className="vh-state-icon"><Clock size={24} /></span>
          <h4 className="vh-state-title">No saved versions yet.</h4>
          <p className="vh-state-text">Press “Create Version” whenever you want to keep a snapshot of this resume.</p>
        </div>
      )
    }
    return (
      <ul className="vh-list">
        {versions.map((version, index) => (
          <li className="vh-item" key={version.id}>
            <div className="vh-item-main">
              <div className="vh-item-head">
                <span className="vh-item-title">Version {version.versionNumber || '—'}</span>
                {index === 0 && <span className="vh-badge">Newest</span>}
                <span className="vh-chip">{typeLabel(version.resumeType)}</span>
                {templateNameOf(version.snapshot) && (
                  <span className="vh-chip vh-chip-template">{templateNameOf(version.snapshot)}</span>
                )}
              </div>
              <p className="vh-item-date">Created: {formatDate(version.createdAt)}</p>
            </div>
            <div className="vh-item-actions">
              <button
                type="button"
                className="vh-action"
                onClick={() => openView(version)}
                disabled={busy}
              >
                <Eye size={14} /> View
              </button>
              <button
                type="button"
                className="vh-action"
                onClick={() => { setNotice(null); setConfirm({ kind: 'restore', version }) }}
                disabled={busy}
              >
                <RotateCcw size={14} /> Restore
              </button>
              <button
                type="button"
                className="vh-action vh-action-danger"
                onClick={() => { setNotice(null); setConfirm({ kind: 'delete', version }) }}
                disabled={busy}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <div className="vh-overlay" onClick={dismissTop}>
        <div
          className="vh-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Version History"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="vh-modal-header">
            <div>
              <h3 className="vh-modal-title">
                <Clock size={18} /> Version History
              </h3>
              <p className="vh-modal-sub">
                Snapshots you saved for this {typeLabel(resumeType).toLowerCase()} resume.
              </p>
            </div>
            <button type="button" className="vh-close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          {notice && (
            <div className="vh-notice">
              <XCircle size={16} />
              {notice}
            </div>
          )}

          <div className="vh-body">{renderList()}</div>
        </div>
      </div>

      {viewing && (
        <div className="vh-overlay vh-overlay-top" onClick={dismissTop}>
          <div
            className="vh-modal vh-modal-view"
            role="dialog"
            aria-modal="true"
            aria-label={`Version ${viewing.version.versionNumber} preview`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vh-modal-header">
              <div>
                <h3 className="vh-modal-title">Version {viewing.version.versionNumber}</h3>
                <p className="vh-modal-sub">
                  Created: {formatDate(viewing.version.createdAt)} · {typeLabel(viewing.version.resumeType)} · Read-only preview
                </p>
              </div>
              <button type="button" className="vh-close" onClick={() => setViewing(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="vh-body">
              <div className="vh-preview">
                <div className="vh-preview-page">
                  <LiveResumePreview
                    config={previewConfig}
                    data={viewing.data.formData}
                    resumeType={viewing.version.resumeType || resumeType}
                    qrCodeEnabled={viewing.data.qrCodeEnabled}
                    resumeId={resumeId}
                  />
                </div>
              </div>
            </div>
            <div className="vh-modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="vh-overlay vh-overlay-top" onClick={dismissTop}>
          <div
            className="vh-modal vh-modal-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`vh-confirm-icon ${confirm.kind === 'delete' ? 'danger' : ''}`}>
              {confirm.kind === 'delete' ? <Trash2 size={24} /> : <RotateCcw size={24} />}
            </div>
            <h3 className="vh-modal-title">
              {confirm.kind === 'delete' ? 'Delete' : 'Restore'} Version {confirm.version.versionNumber}?
            </h3>
            <p className="vh-modal-sub">
              {confirm.kind === 'delete'
                ? 'Deleted versions cannot be recovered.'
                : 'Your current resume data will be replaced with this saved version.'}
            </p>
            {notice && (
              <div className="vh-notice">
                <XCircle size={16} />
                {notice}
              </div>
            )}
            <div className="vh-modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm ${confirm.kind === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                onClick={confirm.kind === 'delete' ? confirmDelete : confirmRestore}
                disabled={busy}
              >
                {busy ? (
                  <span className="vh-btn-busy">
                    <span className="vh-spinner-sm" aria-hidden="true" />
                    Working…
                  </span>
                ) : confirm.kind === 'delete' ? (
                  'Delete'
                ) : (
                  'Restore'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * The editor-facing controls: a visible "Create Version" button, a
 * "Version History" button that opens the modal, and the message shown after a
 * version is created or restored.
 *
 * Creating a version happens only here — never from typing, autosave, preview
 * updates, ATS scoring, Job Matcher or AI enhancement.
 */
export function VersionControls({ resumeId, resumeType, currentSnapshot, onRestore, disabled = false }) {
  const [message, setMessage] = useState(null)
  const [creating, setCreating] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const notify = useCallback((text, type = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMessage({ text, type })
    timerRef.current = setTimeout(() => setMessage(null), 4000)
  }, [])

  const handleCreate = async () => {
    if (creating || disabled) return
    if (!resumeId) {
      notify('Open a resume before creating a version.', 'error')
      return
    }
    if (!firebaseConfigured) {
      notify('Firebase is not configured, so versions cannot be saved.', 'error')
      return
    }
    if (!isVersionHistoryAvailable()) {
      notify('You must be logged in to create a version.', 'error')
      return
    }
    setCreating(true)
    try {
      const created = await createResumeVersion({ resumeId, resumeType, snapshot: currentSnapshot })
      notify(`Version ${created.versionNumber} created successfully.`)
    } catch (err) {
      notify(
        versionErrorCode(err) === 'permission-denied'
          // Also what a brand-new resume returns: it has not reached the
          // account yet, so the rules cannot find its parent document.
          ? 'Could not save the version. Press “Save Resume” first so this resume reaches your account, then try again.'
          : versionErrorMessage(err, 'Could not create a version. Please try again.'),
        'error',
      )
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (snapshot) => {
    await onRestore(snapshot)
    notify('Version restored successfully.')
  }

  return (
    <div className="version-controls">
      {message && (
        <div className={`version-msg ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} strokeWidth={2.5} /> : <XCircle size={16} strokeWidth={2.5} />}
          {message.text}
        </div>
      )}
      <div className="version-controls-row">
        <button
          type="button"
          className="btn btn-secondary btn-sm version-btn"
          onClick={handleCreate}
          disabled={creating || disabled}
        >
          {creating ? (
            <span className="version-btn-busy">
              <span className="vh-spinner-sm" aria-hidden="true" />
              Saving…
            </span>
          ) : (
            <>
              <Layers size={16} />
              Create Version
            </>
          )}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm version-btn"
          onClick={() => setHistoryOpen(true)}
          disabled={disabled}
        >
          <Clock size={16} />
          Version History
        </button>
      </div>

      {historyOpen && (
        <VersionHistory
          resumeId={resumeId}
          resumeType={resumeType}
          onRestore={handleRestore}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  )
}

