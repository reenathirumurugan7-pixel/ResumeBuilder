import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  Briefcase,
  CircleAlert,
  CircleCheck,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderLock,
  Globe,
  GraduationCap,
  LayoutTemplate,
  Lock,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { getUserResumesFromFirestore, setEditorResumeId } from '../utils/resumeStorage'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../firebase'
import { Skeleton, SkeletonText } from '../components/Skeleton'
import {
  isPublicResume,
  lastUpdatedAt,
  recentResumes,
  resumeCompletion,
  resumeTitle,
  resumeTypeOf,
  summarizeResumes,
  toCount,
} from '../utils/resumeMetrics'
import templates from '../data/templates'
import './Dashboard.css'

const QUICK_ACTIONS = [
  {
    to: '/resume-type',
    icon: Plus,
    title: 'Create New Resume',
    desc: 'Start a blank fresher or experienced resume.',
  },
  {
    to: '/enhance',
    icon: Sparkles,
    title: 'Enhance with AI',
    desc: 'Rewrite and strengthen an existing draft.',
  },
  {
    to: '/templates',
    icon: LayoutTemplate,
    title: 'Browse Templates',
    desc: 'Pick a layout and customise the colours.',
  },
  {
    to: '/resume-vault',
    icon: FolderLock,
    title: 'My Resume Vault',
    desc: 'Manage, publish, rename or share resumes.',
  },
  {
    to: '/job-matcher',
    icon: Target,
    title: 'Job Description Matcher',
    desc: 'Score a resume against a job posting.',
  },
]

const SUMMARY_CARDS = [
  { key: 'total', label: 'Total Resumes', icon: FileText, tone: 'blue', hint: 'Saved in your vault' },
  { key: 'published', label: 'Published', icon: Globe, tone: 'green', hint: 'Live behind a public link' },
  { key: 'drafts', label: 'Drafts', icon: Lock, tone: 'amber', hint: 'Visible only to you' },
  { key: 'views', label: 'Total Views', icon: Eye, tone: 'violet', hint: 'Counted on published resumes' },
  { key: 'downloads', label: 'Downloads', icon: Download, tone: 'blue', hint: 'PDF and docx downloads' },
  { key: 'qrScans', label: 'QR Scans', icon: QrCode, tone: 'green', hint: 'Scans of your QR codes' },
]

function greetingName(user) {
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : ''
  if (displayName) return displayName.split(/\s+/)[0]
  const email = typeof user?.email === 'string' ? user.email.trim() : ''
  if (email && email.includes('@')) return email.split('@')[0]
  return 'there'
}

function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function templateName(resume) {
  const templateId = resume?.config?.templateId
  if (!templateId) return 'Default layout'
  const template = templates.find((item) => item.id === templateId)
  return template?.name || 'Custom layout'
}

function relativeTime(millis) {
  if (!millis) return 'Last edit not recorded'
  const diff = Date.now() - millis
  if (diff < 0) return 'Updated just now'
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Updated just now'
  if (minutes < 60) return `Updated ${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Updated ${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `Updated ${days} day${days > 1 ? 's' : ''} ago`
  return `Updated ${new Date(millis).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completionId, setCompletionId] = useState(null)

  // One ownership-scoped query per attempt. The retry handler reuses the exact
  // same code path, so no interval, listener or per-card fetch is involved.
  const load = useCallback(async () => {
    if (!user) {
      setResumes([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const docs = await getUserResumesFromFirestore(user.uid)
      setResumes(Array.isArray(docs) ? docs : [])
    } catch {
      setError('We could not load your dashboard right now. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading || !user) return
    let active = true
    getUserResumesFromFirestore(user.uid)
      .then((docs) => {
        if (active) setResumes(Array.isArray(docs) ? docs : [])
      })
      .catch(() => {
        if (active) {
          setError('We could not load your dashboard right now. Check your connection and try again.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [authLoading, user])

  const summary = useMemo(() => summarizeResumes(resumes), [resumes])
  const recent = useMemo(() => recentResumes(resumes, 5), [resumes])

  const completions = useMemo(
    () =>
      recent
        .map((resume) => ({ resume, completion: resumeCompletion(resume) }))
        .filter((entry) => entry.completion),
    [recent]
  )

  const activeCompletion = useMemo(() => {
    if (!completions.length) return null
    return completions.find((entry) => entry.resume.id === completionId) || completions[0]
  }, [completions, completionId])

  const performance = useMemo(() => {
    return resumes
      .map((resume) => ({
        resume,
        views: isPublicResume(resume) ? toCount(resume.views) : 0,
        downloads: toCount(resume.downloads),
        qrScans: isPublicResume(resume) ? toCount(resume.qrScans) : 0,
      }))
      .filter((row) => row.views + row.downloads + row.qrScans > 0)
      .sort((a, b) => {
        const totalA = a.views + a.downloads + a.qrScans
        const totalB = b.views + b.downloads + b.qrScans
        if (totalB !== totalA) return totalB - totalA
        return lastUpdatedAt(b.resume) - lastUpdatedAt(a.resume)
      })
      .slice(0, 5)
  }, [resumes])

  const openInEditor = (resume) => {
    const experienced = resumeTypeOf(resume) === 'experienced'
    setEditorResumeId(experienced ? 'experienced_resume_id' : 'fresher_resume_id', resume.id)
    navigate(experienced ? '/editor/experienced' : '/editor/fresher')
  }

  const showSkeletons = loading && resumes.length === 0

  const header = (
    <header className="dash-header">
      <div className="dash-header-text">
        <p className="dash-eyebrow">
          <Clock size={14} /> {greetingForNow()}
        </p>
        <h1 className="dash-title">Welcome back, {greetingName(user)}</h1>
        <p className="dash-subtitle">
          {summary.total > 0
            ? `You have ${summary.total} resume${summary.total === 1 ? '' : 's'} saved · ${summary.published} published · ${summary.drafts} still private.`
            : 'Your resumes, templates and sharing tools in one place.'}
        </p>
      </div>
      <div className="dash-header-actions">
        <Link className="dash-btn dash-btn-ghost" to="/resume-vault">
          <FolderLock size={16} /> Resume Vault
        </Link>
        <Link className="dash-btn dash-btn-primary" to="/resume-type">
          <Plus size={16} /> Create Resume
        </Link>
      </div>
    </header>
  )

  const quickActions = (
    <section className="dash-section" aria-labelledby="dash-quick-title">
      <div className="dash-section-head">
        <h2 className="dash-section-title" id="dash-quick-title">
          <Sparkles size={18} /> Quick Actions
        </h2>
      </div>
      <div className="dash-quick-grid">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <Link className="dash-quick-card" to={action.to} key={action.to}>
              <span className="dash-quick-icon">
                <Icon size={20} />
              </span>
              <span className="dash-quick-text">
                <span className="dash-quick-name">{action.title}</span>
                <span className="dash-quick-desc">{action.desc}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )

  if (!firebaseConfigured) {
    return (
      <div className="dash-page">
        <div className="container dash-narrow">
          {header}
          <div className="dash-note dash-note-warning">
            <CircleAlert size={18} />
            <div>
              <strong>Cloud sync is not configured.</strong>
              <p>
                Add your Firebase keys to <code>.env</code> to store resumes in your vault and
                publish share links. Your saved data stays on this device until then.
              </p>
            </div>
          </div>
          {quickActions}
        </div>
      </div>
    )
  }

  if (showSkeletons) {
    return (
      <div className="dash-page">
        <div className="container">
          {header}
          <section className="dash-section" aria-hidden="true">
            <div className="dash-stat-grid">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div className="skeleton-card dash-skeleton-card" key={index}>
                  <Skeleton height="104px" borderRadius="16px" style={{ marginBottom: 0 }} />
                </div>
              ))}
            </div>
          </section>
          <section className="dash-section" aria-hidden="true">
            <div className="dash-split">
              <div className="skeleton-card dash-skeleton-panel">
                <Skeleton height="20px" width="45%" borderRadius="6px" style={{ marginBottom: '18px' }} />
                <Skeleton height="16px" width="60%" style={{ marginBottom: '12px' }} />
                <SkeletonText lines={2} lastWidth="75%" />
              </div>
              <div className="skeleton-card dash-skeleton-panel">
                <Skeleton height="20px" width="40%" borderRadius="6px" style={{ marginBottom: '18px' }} />
                <Skeleton height="36px" width="30%" style={{ marginBottom: '12px' }} />
                <Skeleton height="10px" borderRadius="999px" style={{ marginBottom: '14px' }} />
                <SkeletonText lines={2} lastWidth="50%" />
              </div>
            </div>
          </section>
          <section className="dash-section" aria-hidden="true">
            <div className="dash-list">
              {[0, 1, 2].map((index) => (
                <div className="skeleton-card dash-skeleton-row" key={index}>
                  <Skeleton height="14px" width="45%" borderRadius="4px" style={{ marginBottom: '10px' }} />
                  <Skeleton height="12px" width="28%" borderRadius="4px" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (error && resumes.length === 0) {
    return (
      <div className="dash-page">
        <div className="container dash-narrow">
          {header}
          <div className="dash-state">
            <span className="dash-state-icon dash-state-icon-error">
              <CircleAlert size={26} />
            </span>
            <h2 className="dash-state-title">Dashboard unavailable</h2>
            <p className="dash-state-text">{error}</p>
            <button className="dash-btn dash-btn-primary" type="button" onClick={load}>
              <RefreshCw size={16} /> Try again
            </button>
          </div>
          {quickActions}
        </div>
      </div>
    )
  }

  return (
    <div className="dash-page">
      <div className="container">
        {header}

        {error && (
          <div className="dash-note dash-note-warning dash-inline-note">
            <CircleAlert size={16} />
            <span>{error} Showing the data loaded earlier.</span>
          </div>
        )}

        {summary.total === 0 ? (
          <div className="dash-state">
            <span className="dash-state-icon">
              <FileText size={26} />
            </span>
            <h2 className="dash-state-title">No resumes yet</h2>
            <p className="dash-state-text">
              Create your first resume to see completion, publishing and sharing insights here.
            </p>
            <div className="dash-state-actions">
              <Link className="dash-btn dash-btn-primary" to="/resume-type">
                <Plus size={16} /> Create your first resume
              </Link>
              <Link className="dash-btn dash-btn-ghost" to="/templates">
                <LayoutTemplate size={16} /> Browse templates
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section className="dash-section" aria-labelledby="dash-summary-title">
              <div className="dash-section-head">
                <h2 className="dash-section-title" id="dash-summary-title">
                  <Activity size={18} /> Resume Overview
                </h2>
                <span className="dash-section-note">Live from your vault</span>
              </div>
              <div className="dash-stat-grid">
                {SUMMARY_CARDS.map((card) => {
                  const Icon = card.icon
                  return (
                    <article className="dash-stat" key={card.key}>
                      <span className={`dash-stat-icon dash-tone-${card.tone}`}>
                        <Icon size={18} />
                      </span>
                      <div className="dash-stat-body">
                        <p className="dash-stat-value">{summary[card.key].toLocaleString()}</p>
                        <p className="dash-stat-label">{card.label}</p>
                        <p className="dash-stat-hint">{card.hint}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="dash-section dash-split">
              <div className="dash-panel">
                <div className="dash-section-head">
                  <h2 className="dash-section-title">
                    <Trophy size={18} /> Most Viewed Resume
                  </h2>
                </div>
                {summary.mostViewed ? (
                  <div className="dash-featured">
                    <div className="dash-featured-main">
                      <span className="dash-featured-icon">
                        <TrendingUp size={20} />
                      </span>
                      <div>
                        <p className="dash-featured-name">{resumeTitle(summary.mostViewed)}</p>
                        <p className="dash-featured-meta">
                          {templateName(summary.mostViewed)} ·{' '}
                          {resumeTypeOf(summary.mostViewed) === 'experienced'
                            ? 'Experienced'
                            : 'Fresher'}{' '}
                          · {relativeTime(lastUpdatedAt(summary.mostViewed))}
                        </p>
                      </div>
                    </div>
                    <div className="dash-featured-metrics">
                      <div className="dash-mini-metric">
                        <Eye size={15} />
                        <span className="dash-mini-value">{summary.mostViewedCount}</span>
                        <span className="dash-mini-label">Views</span>
                      </div>
                      <div className="dash-mini-metric">
                        <Download size={15} />
                        <span className="dash-mini-value">{toCount(summary.mostViewed.downloads)}</span>
                        <span className="dash-mini-label">Downloads</span>
                      </div>
                      <div className="dash-mini-metric">
                        <QrCode size={15} />
                        <span className="dash-mini-value">{toCount(summary.mostViewed.qrScans)}</span>
                        <span className="dash-mini-label">QR scans</span>
                      </div>
                    </div>
                    <div className="dash-panel-actions">
                      <button
                        className="dash-btn dash-btn-primary"
                        type="button"
                        onClick={() => openInEditor(summary.mostViewed)}
                      >
                        <Pencil size={15} /> Edit
                      </button>
                      <Link
                        className="dash-btn dash-btn-ghost"
                        to={`/resume/${summary.mostViewed.id}`}
                      >
                        <ExternalLink size={15} /> View
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="dash-panel-empty">
                    <p className="dash-panel-empty-text">
                      {summary.published > 0
                        ? 'None of your published resumes has recorded a view yet. Share a public link or QR code to start tracking.'
                        : 'Publish a resume to start tracking views, downloads and QR scans.'}
                    </p>
                    <Link className="dash-btn dash-btn-ghost" to="/resume-vault">
                      <FolderLock size={15} /> Open Resume Vault
                    </Link>
                  </div>
                )}
              </div>

              <div className="dash-panel">
                <div className="dash-section-head">
                  <h2 className="dash-section-title">
                    <CircleCheck size={18} /> Resume Completion
                  </h2>
                  {completions.length > 1 && (
                    <div className="dash-chips">
                      {completions.map((entry) => (
                        <button
                          className={`dash-chip ${
                            activeCompletion?.resume.id === entry.resume.id ? 'is-active' : ''
                          }`}
                          type="button"
                          key={entry.resume.id}
                          onClick={() => setCompletionId(entry.resume.id)}
                        >
                          {resumeTitle(entry.resume)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {activeCompletion ? (
                  <div className="dash-completion">
                    <div className="dash-completion-top">
                      <div>
                        <p className="dash-featured-name">
                          {resumeTitle(activeCompletion.resume)}
                        </p>
                        <p className="dash-featured-meta">
                          {activeCompletion.completion.filled} of{' '}
                          {activeCompletion.completion.total} sections filled
                        </p>
                      </div>
                      <span className="dash-completion-score">
                        {activeCompletion.completion.percent}%
                      </span>
                    </div>
                    <div
                      className="dash-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={activeCompletion.completion.percent}
                      aria-label="Resume completion"
                    >
                      <span
                        className="dash-progress-bar"
                        style={{ width: `${activeCompletion.completion.percent}%` }}
                      />
                    </div>
                    {activeCompletion.completion.missing.length > 0 ? (
                      <p className="dash-completion-hint">
                        Still missing: {activeCompletion.completion.missing.join(', ')}
                      </p>
                    ) : (
                      <p className="dash-completion-hint dash-completion-done">
                        Every recommended section is filled in.
                      </p>
                    )}
                    <div className="dash-panel-actions">
                      {activeCompletion.completion.atsScore !== null && (
                        <span className="dash-badge">ATS score {activeCompletion.completion.atsScore}</span>
                      )}
                      <button
                        className="dash-btn dash-btn-primary"
                        type="button"
                        onClick={() => openInEditor(activeCompletion.resume)}
                      >
                        <Pencil size={15} /> Continue editing
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="dash-panel-empty">
                    <p className="dash-panel-empty-text">
                      Completion is not available yet. It appears once a resume has saved content.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="dash-section" aria-labelledby="dash-recent-title">
              <div className="dash-section-head">
                <h2 className="dash-section-title" id="dash-recent-title">
                  <Clock size={18} /> Recent Resumes
                </h2>
                {resumes.length > recent.length && (
                  <Link className="dash-section-link" to="/resume-vault">
                    View all {resumes.length}
                  </Link>
                )}
              </div>
              <div className="dash-list">
                {recent.map((resume) => {
                  const publicResume = isPublicResume(resume)
                  return (
                    <article className="dash-row" key={resume.id}>
                      <span className={`dash-row-icon ${publicResume ? 'is-public' : ''}`}>
                        {resumeTypeOf(resume) === 'experienced' ? (
                          <Briefcase size={18} />
                        ) : (
                          <GraduationCap size={18} />
                        )}
                      </span>
                      <div className="dash-row-main">
                        <div className="dash-row-head">
                          <p className="dash-row-name">{resumeTitle(resume)}</p>
                          <span className={`dash-status ${publicResume ? 'is-public' : ''}`}>
                            {publicResume ? (
                              <>
                                <Globe size={12} /> Published
                              </>
                            ) : (
                              <>
                                <Lock size={12} /> Draft
                              </>
                            )}
                          </span>
                        </div>
                        <p className="dash-row-meta">
                          {templateName(resume)} · {relativeTime(lastUpdatedAt(resume))}
                          {publicResume ? ` · ${toCount(resume.views)} views` : ''}
                        </p>
                      </div>
                      <div className="dash-row-actions">
                        <button
                          className="dash-btn dash-btn-ghost dash-btn-sm"
                          type="button"
                          onClick={() => openInEditor(resume)}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        {publicResume && (
                          <Link className="dash-btn dash-btn-ghost dash-btn-sm" to={`/resume/${resume.id}`}>
                            <ExternalLink size={14} /> View
                          </Link>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="dash-section" aria-labelledby="dash-performance-title">
              <div className="dash-section-head">
                <h2 className="dash-section-title" id="dash-performance-title">
                  <TrendingUp size={18} /> Performance
                </h2>
                <span className="dash-section-note">
                  Views and QR scans are counted only while a resume is published
                </span>
              </div>
              {performance.length > 0 ? (
                <div className="dash-table" role="table">
                  <div className="dash-table-head" role="row">
                    <span role="columnheader">Resume</span>
                    <span role="columnheader">Views</span>
                    <span role="columnheader">Downloads</span>
                    <span role="columnheader">QR scans</span>
                  </div>
                  {performance.map((row) => (
                    <div className="dash-table-row" role="row" key={row.resume.id}>
                      <span className="dash-table-name" role="cell">
                        {resumeTitle(row.resume)}
                      </span>
                      <span role="cell" data-label="Views">
                        {row.views}
                      </span>
                      <span role="cell" data-label="Downloads">
                        {row.downloads}
                      </span>
                      <span role="cell" data-label="QR scans">
                        {row.qrScans}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dash-panel-empty">
                  <p className="dash-panel-empty-text">
                    No activity recorded yet. Download one of your resumes, or publish a resume and
                    share its link or QR code — the counters above fill in automatically.
                  </p>
                  <Link className="dash-btn dash-btn-ghost" to="/resume-vault">
                    <FolderLock size={15} /> Open Resume Vault
                  </Link>
                </div>
              )}
            </section>
          </>
        )}

        {quickActions}
      </div>
    </div>
  )
}

export default Dashboard