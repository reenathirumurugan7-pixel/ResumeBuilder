import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pencil, Eye, Download, FileText, QrCode, Link as LinkIcon, Copy, RefreshCw, Trash2, Search, X, Folder, GraduationCap, Briefcase, Globe, Lock } from 'lucide-react'
import { getUserResumesFromFirestore, deleteResumeFromFirestore, renameResumeInFirestore, duplicateResumeInFirestore, toggleResumeVisibility, recordResumeDownload, resumeUrl, resumeQrUrl, defaultResumeName, setEditorResumeId } from '../utils/resumeStorage'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../firebase'
import LiveResumePreview from '../components/LiveResumePreview'
import ResumeQRCode from '../components/ResumeQRCode'
import { SkeletonResumeCard } from '../components/Skeleton'
import ResumeStats from '../components/ResumeStats'
import { calculateAtsScore } from '../services/atsScore'
import templates from '../data/templates'
import './ResumeVault.css'

function formatDate(ts) {
  if (!ts) return 'Unknown'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function atsLabel(score) {
  if (score >= 95) return { text: 'Excellent', cls: 'ats-high' }
  if (score >= 70) return { text: 'Good', cls: 'ats-mid' }
  return { text: 'Needs Work', cls: 'ats-low' }
}

// Resume documents written before a counter existed simply have no such field.
function toCount(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function ResumeCard({ resume, onRename, onDelete, onDuplicate, onToggleVisibility, onDownloadRecorded, onMessage }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const type = resume.resumeType === 'experienced' ? 'experienced' : 'fresher'
  const name = resume.name || defaultResumeName(resume.formData) || 'My Resume'
  const isPublic = resume.isPublic === true
  const templateId = resume.config && resume.config.templateId
  const template = templateId ? templates.find((t) => t.id === templateId) : null
  const configPreview = resume.config ? { ...resume.config, name: template ? template.name : 'Template' } : null
  const atsScore = resume.formData ? calculateAtsScore(resume.formData, type).total : null
  // `url` is the clean public link that gets copied and shared by hand;
  // `qrUrl` is the same page plus `src=qr`, so only a scan of the printed code
  // is tallied as a QR scan. Keeping them separate means "Copy public link"
  // hands out a link that counts as a view, never as a scan.
  const url = resumeUrl(resume.id)
  const qrUrl = resumeQrUrl(resume.id)
  const editPath = type === 'experienced' ? '/editor/experienced' : '/editor/fresher'
  const downloads = toCount(resume.downloads)
  const qrScans = toCount(resume.qrScans)

  const toggleMenu = () => setMenuOpen((v) => !v)

  const run = async (key, fn) => {
    setBusy(key)
    try {
      await fn()
    } catch {
      onMessage(`Action failed. Please try again.`, 'error')
    } finally {
      setBusy(null)
      setMenuOpen(false)
    }
  }

  // The export libraries (jsPDF, docx) are large and only needed once someone
  // actually exports, so they are fetched on demand instead of on page load. The
  // counter is written only after the file has been handed to the browser, so a
  // cancelled/failed export is never counted.
  const handlePdf = () => {
    run('pdf', async () => {
      const { generatePDF } = await import('../utils/pdfExport')
      const file = generatePDF(resume.formData, type, resume.config || null, {
        qrCodeEnabled: resume.qrCodeEnabled,
        resumeId: resume.id,
      })
      const counted = await recordResumeDownload(resume.id)
      if (counted) onDownloadRecorded(resume.id)
      onMessage(`PDF downloaded: ${file}`, 'success')
    })
  }

  const handleDocx = () => {
    run('docx', async () => {
      const { generateWord } = await import('../utils/wordExport')
      const file = await generateWord(resume.formData, type, resume.config || null, {
        qrCodeEnabled: resume.qrCodeEnabled === true,
        resumeId: resume.id,
      })
      const counted = await recordResumeDownload(resume.id)
      if (counted) onDownloadRecorded(resume.id)
      onMessage(`Word document downloaded: ${file}`, 'success')
    })
  }

  const handleCopyLink = () => {
    run('copy', async () => {
      await navigator.clipboard.writeText(url)
      onMessage('Public link copied!', 'success')
    })
  }

  const handleVisibilityToggle = () => {
    run('visibility', () => onToggleVisibility(resume))
  }

  return (
    <div className="vault-card">
      <div className="vault-card-preview">
        {configPreview ? (
          <div className="vault-preview-scaled">
            <div className="vault-preview-inner">
              <LiveResumePreview
                config={configPreview}
                data={resume.formData || {}}
                resumeType={type}
              />
            </div>
          </div>
        ) : (
          <div className="vault-preview-empty">
            <Folder size={24} />
            <span>No template selected</span>
          </div>
        )}
      </div>

      <div className="vault-card-body">
        <div className="vault-card-top">
          <div className="vault-card-title-wrap">
            <h3 className="vault-card-title" title={name}>{name}</h3>
            <span className={`vault-type-badge vault-type-${type}`}>
              {type === 'experienced' ? <Briefcase size={14} /> : <GraduationCap size={14} />} {type === 'experienced' ? 'Experienced' : 'Fresher'}
            </span>
            <span
              className={`vault-visibility-badge ${isPublic ? 'public' : 'private'}`}
              title={isPublic ? 'This resume is publicly visible via its link' : 'This resume is private and only visible to you'}
            >
              {isPublic ? <Globe size={14} /> : <Lock size={14} />} {isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          <button className="vault-menu-btn" onClick={toggleMenu} aria-label="Resume actions">
            <span></span><span></span><span></span>
          </button>
          {menuOpen && (
            <div className="vault-menu">
              <button className="vault-menu-item" onClick={() => { setEditorResumeId(type === 'experienced' ? 'experienced_resume_id' : 'fresher_resume_id', resume.id); navigate(editPath); }}>
                <Pencil size={16} /> Edit Resume
              </button>
              <button className="vault-menu-item" onClick={() => setShowQr(true)}>
                <Eye size={16} /> Preview Resume
              </button>
              <button className="vault-menu-item" onClick={handlePdf} disabled={busy === 'pdf'}>
                <Download size={16} /> {busy === 'pdf' ? 'Generating...' : 'Download PDF'}
              </button>
              <button className="vault-menu-item" onClick={handleDocx} disabled={busy === 'docx'}>
                <FileText size={16} /> {busy === 'docx' ? 'Generating...' : 'Download DOCX'}
              </button>
              <button className="vault-menu-item" onClick={() => { setShowQr(true); setMenuOpen(false) }}>
                <QrCode size={16} /> View QR Code
              </button>
              <button className="vault-menu-item" onClick={handleVisibilityToggle} disabled={busy === 'visibility'}>
                {isPublic ? <Lock size={16} /> : <Globe size={16} />} {busy === 'visibility' ? 'Updating...' : (isPublic ? 'Make Private' : 'Make Public')}
              </button>
              <button className="vault-menu-item" onClick={handleCopyLink} disabled={busy === 'copy'}>
                <LinkIcon size={16} /> Copy Public Link
              </button>
              <button className="vault-menu-item" onClick={() => onDuplicate(resume)} disabled={busy === 'dup'}>
                <Copy size={16} /> Duplicate
              </button>
              <button className="vault-menu-item" onClick={() => onRename(resume)}>
                <Pencil size={16} /> Rename
              </button>
              <button className="vault-menu-item danger" onClick={() => onDelete(resume)}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="vault-card-meta">
          <span className="vault-meta-item">
            <RefreshCw size={14} /> Updated {formatDate(resume.updatedAt)}
          </span>
          <span className="vault-meta-item">
            <Folder size={14} /> {template ? template.name : 'No Template'}
          </span>
          <span className="vault-meta-item vault-meta-stat" title={`${downloads} successful PDF/DOCX download${downloads === 1 ? '' : 's'}`}>
            <Download size={14} /> {downloads}
          </span>
          <span className="vault-meta-item vault-meta-stat" title={`${qrScans} QR scan${qrScans === 1 ? '' : 's'} of this resume's public link`}>
            <QrCode size={14} /> {qrScans}
          </span>
          {atsScore != null && (
            <span className={`vault-ats ${atsLabel(atsScore).cls}`} title={`ATS Score: ${atsScore}/100`}>
              ATS {atsScore}
            </span>
          )}
        </div>

        <div className="vault-card-actions">
          <button className="vault-action-btn vault-action-primary" onClick={() => { setEditorResumeId(type === 'experienced' ? 'experienced_resume_id' : 'fresher_resume_id', resume.id); navigate(editPath); }}>
            <Pencil size={16} /> Edit
          </button>
          <button className="vault-action-btn" onClick={() => setShowQr(true)}>
            <Eye size={16} /> Preview
          </button>
          <button className="vault-action-btn" onClick={handlePdf}>
            <Download size={16} /> PDF
          </button>
          <button className="vault-action-btn" onClick={() => { onMessage('', ''); setShowQr(true) }}>
            <QrCode size={16} /> QR
          </button>
        </div>

        <div className="vault-card-link">
          <span className="vault-card-link-label">
            <LinkIcon size={14} /> Public Link
          </span>
          <div className="vault-card-link-row">
            <span className="vault-card-link-text" title={url}>{url}</span>
            <button
              className="vault-card-link-copy"
              onClick={handleCopyLink}
              disabled={busy === 'copy'}
              aria-label="Copy public link"
            >
              <Copy size={14} /> {busy === 'copy' ? 'Copying...' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {showQr && (
        <QrModal url={url} qrUrl={qrUrl} onClose={() => setShowQr(false)} onMessage={onMessage} />
      )}
    </div>
  )
}

function QrModal({ url, qrUrl, onClose, onMessage }) {
  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
        <button className="vault-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <h3 className="vault-modal-title">Resume QR Code</h3>
        <div className="vault-modal-qr">
          <ResumeQRCode url={qrUrl} size={180} />
        </div>
        <p className="vault-modal-sub">Scan with your phone camera to view this resume.</p>
        <div className="vault-modal-link">
          <span className="vault-modal-link-text">{url}</span>
          <button
            className="vault-action-btn vault-action-primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                onMessage('Public resume link copied to clipboard.', 'success')
              } catch {
                onMessage('Could not copy link.', 'error')
              }
            }}
          >
            <LinkIcon size={16} /> Copy Link
          </button>
        </div>
      </div>
    </div>
  )
}

function ResumeVault() {
  const { user, loading: authLoading } = useAuth()
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [notification, setNotification] = useState(null)

  const notify = useCallback((message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const docs = await getUserResumesFromFirestore(user ? user.uid : null)
      setResumes(docs)
    } catch {
      setError('Unable to load your resumes. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading || !user) return
    let active = true
    getUserResumesFromFirestore(user.uid)
      .then((docs) => {
        if (active) setResumes(docs)
      })
      .catch(() => {
        if (active) setError('Unable to load your resumes. Please check your connection and try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [authLoading, user])

  const filtered = useMemo(() => {
    let list = [...resumes]
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const n = (r.name || defaultResumeName(r.formData) || '').toLowerCase()
        return n.includes(q)
      })
    }
    if (typeFilter !== 'all') {
      list = list.filter((r) => (r.resumeType === 'experienced' ? 'experienced' : 'fresher') === typeFilter)
    }
    if (sortBy === 'name') {
      list.sort((a, b) => {
        const na = (a.name || defaultResumeName(a.formData) || '').toLowerCase()
        const nb = (b.name || defaultResumeName(b.formData) || '').toLowerCase()
        return na.localeCompare(nb)
      })
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
    } else {
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    }
    return list
  }, [resumes, query, typeFilter, sortBy])

  const handleRename = async (resume) => {
    setRenameTarget(resume)
    setRenameValue(resume.name || defaultResumeName(resume.formData) || '')
  }

  const submitRename = async () => {
    const name = renameValue.trim()
    if (!renameTarget) return
    if (!name) {
      notify('Resume name cannot be empty.', 'error')
      return
    }
    try {
      await renameResumeInFirestore(renameTarget.id, name)
      setResumes((prev) => prev.map((r) => (r.id === renameTarget.id ? { ...r, name, updatedAt: Date.now() } : r)))
      setRenameTarget(null)
      notify('Resume renamed successfully.')
    } catch {
      notify('Failed to rename resume.', 'error')
    }
  }

  const handleDelete = (resume) => {
    setDeleteTarget(resume)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteResumeFromFirestore(deleteTarget.id)
      setResumes((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
      notify('Resume deleted.')
    } catch {
      notify('Failed to delete resume.', 'error')
    }
  }

  const handleDuplicate = async (resume) => {
    try {
      const copy = await duplicateResumeInFirestore(resume.id, user ? user.uid : null)
      if (!copy) {
        notify('Could not duplicate resume.', 'error')
        return
      }
      setResumes((prev) => [copy, ...prev])
      notify('Resume duplicated.')
    } catch {
      notify('Failed to duplicate resume.', 'error')
    }
  }

  const handleToggleVisibility = async (resume) => {
    const next = !(resume.isPublic === true)
    try {
      await toggleResumeVisibility(resume.id, next)
      setResumes((prev) => prev.map((r) => (r.id === resume.id ? { ...r, isPublic: next, updatedAt: Date.now() } : r)))
      notify(next ? 'Resume is now public.' : 'Resume is now private.')
    } catch {
      notify('Failed to update resume visibility.', 'error')
    }
  }

  // Keeps the vault card and the dashboard totals in step with a download that
  // was just tallied in Firestore, without waiting for a full reload.
  const handleDownloadRecorded = useCallback((resumeId) => {
    setResumes((prev) => prev.map((r) => (r.id === resumeId ? { ...r, downloads: toCount(r.downloads) + 1 } : r)))
  }, [])

  if (authLoading) {
    return (
      <div className="vault-page">
        <div className="container">
          <div className="vault-grid">
            <SkeletonResumeCard />
            <SkeletonResumeCard />
            <SkeletonResumeCard />
          </div>
        </div>
      </div>
    )
  }

  if (!firebaseConfigured) {
    return (
      <div className="vault-page">
        <div className="container vault-empty">
          <div className="vault-empty-icon"><Folder size={24} /></div>
          <h1 className="vault-empty-title">Resume Vault</h1>
          <p className="vault-empty-text">
            Firebase is not configured. Add the VITE_FIREBASE_* environment variables to your .env file.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="vault-page">
      <div className="container">
        <header className="vault-header">
          <div className="vault-header-icon"><Folder size={24} /></div>
          <div>
            <h1 className="vault-title">Resume Vault</h1>
            <p className="vault-subtitle">Securely access and manage all your saved resumes.</p>
          </div>
          <Link to="/resume-type" className="btn btn-primary vault-create-btn">
            + New Resume
          </Link>
        </header>

        {notification && (
          <div className={`vault-notification ${notification.type}`}>
            {notification.type === 'success' ? <Download size={16} /> : <X size={16} />}
            {notification.message}
          </div>
        )}

        {!error && <ResumeStats resumes={resumes} loading={loading && resumes.length === 0} />}

        <div className="vault-controls">
          <div className="vault-search">
            <span className="vault-search-icon"><Search size={16} /></span>
            <input
              type="text"
              className="vault-search-input"
              placeholder="Search by resume name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="vault-filters">
            <div className="vault-filter-group">
              {[
                { id: 'all', label: 'All' },
                { id: 'fresher', label: 'Fresher' },
                { id: 'experienced', label: 'Experienced' },
              ].map((f) => (
                <button
                  key={f.id}
                  className={`vault-filter-chip ${typeFilter === f.id ? 'active' : ''}`}
                  onClick={() => setTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              className="vault-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort resumes"
            >
              <option value="recent">Recently Updated</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name (A&ndash;Z)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="vault-grid">
            <SkeletonResumeCard />
            <SkeletonResumeCard />
            <SkeletonResumeCard />
          </div>
        ) : error ? (
          <div className="vault-state">
            <div className="vault-state-error-icon"><X size={24} /></div>
            <h2 className="vault-state-title">Something went wrong</h2>
            <p className="vault-state-text">{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={load}>Try Again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="vault-state vault-empty-state">
            <div className="vault-empty-icon"><Folder size={24} /></div>
            {resumes.length === 0 ? (
              <>
                <div className="vault-empty-title">No saved resumes found</div>
                <p className="vault-state-text">Create your first resume.</p>
                <Link to="/resume-type" className="btn btn-primary btn-sm">Create Resume</Link>
              </>
            ) : (
              <>
                <h2 className="vault-state-title">No matches</h2>
                <p className="vault-state-text">Try adjusting your search or filters.</p>
              </>
            )}
          </div>
        ) : (
          <div className="vault-grid">
            {filtered.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                onRename={handleRename}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onToggleVisibility={handleToggleVisibility}
                onDownloadRecorded={handleDownloadRecorded}
                onMessage={notify}
              />
            ))}
          </div>
        )}
      </div>

      {renameTarget && (
        <div className="vault-modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="vault-modal vault-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="vault-modal-title">Rename Resume</h3>
            <input
              className="vault-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenameTarget(null) }}
            />
            <div className="vault-modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={submitRename}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="vault-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="vault-modal vault-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-delete-icon"><Trash2 size={24} /></div>
            <h3 className="vault-modal-title">Delete Resume?</h3>
            <p className="vault-modal-sub">
              This will permanently delete &ldquo;{deleteTarget.name || defaultResumeName(deleteTarget.formData) || 'this resume'}&rdquo; and its public link.
              This action cannot be undone.
            </p>
            <div className="vault-modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResumeVault
