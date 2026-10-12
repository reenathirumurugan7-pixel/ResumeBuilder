import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Clock,
  Download,
  Eye,
  FileText,
  Globe,
  Lock,
  LogIn,
  MessageSquare,
  QrCode,
  RefreshCw,
  Users,
} from 'lucide-react'
import { getAllFeedback, getAllResumes } from '../../services/adminFirestore'
import { listAdminUsers } from '../../services/adminApi'
import { firebaseConfigured } from '../../firebase'
import { isPublicResume, resumeTitle, resumeTypeOf, sortByRecent, toCount } from '../../utils/resumeMetrics'
import templates from '../../data/templates'
import { relativeTime, shortUid } from './utils'
import { AdminEmpty, AdminNote, AdminSectionHead, AdminStat, AdminState } from './State'
import './Admin.css'

function templateName(resume) {
  const templateId = resume?.config?.templateId
  if (!templateId) return 'Default layout'
  const template = templates.find((item) => item.id === templateId)
  return template?.name || 'Custom layout'
}

// User counts and recent sign-ins come from the server-side admin API, which is
// also the only place the Firebase Auth directory can be read. Resumes and
// feedback are read from Firestore under admin rules. If the users API is not
// reachable (e.g. no service account in this environment) the user-derived
// numbers are shown as unavailable rather than invented.
function loadAdminData() {
  return Promise.all([
    getAllResumes(),
    getAllFeedback(),
    listAdminUsers().catch(() => null),
  ])
}

function userLabel(user) {
  if (!user) return 'Unnamed user'
  if (user.displayName) return user.displayName
  if (user.email) return user.email.split('@')[0]
  return shortUid(user.uid)
}

function userSignedInAt(user) {
  if (!user?.lastSignInTime) return 0
  const millis = new Date(user.lastSignInTime).getTime()
  return Number.isFinite(millis) ? millis : 0
}

export default function AdminOverview() {
  const [resumes, setResumes] = useState([])
  const [feedback, setFeedback] = useState([])
  const [users, setUsers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    loadAdminData()
      .then(([resumeDocs, feedbackDocs, userRecords]) => {
        if (!active) return
        setResumes(Array.isArray(resumeDocs) ? resumeDocs : [])
        setFeedback(Array.isArray(feedbackDocs) ? feedbackDocs : [])
        setUsers(Array.isArray(userRecords) ? userRecords : null)
      })
      .catch(() => {
        if (active) setError('We could not load the admin data right now. Try again in a moment.')
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
    loadAdminData()
      .then(([resumeDocs, feedbackDocs, userRecords]) => {
        setResumes(Array.isArray(resumeDocs) ? resumeDocs : [])
        setFeedback(Array.isArray(feedbackDocs) ? feedbackDocs : [])
        setUsers(Array.isArray(userRecords) ? userRecords : null)
      })
      .catch(() => setError('We could not load the admin data right now. Try again in a moment.'))
      .finally(() => setLoading(false))
  }

  const summary = useMemo(() => {
    let published = 0
    let views = 0
    let downloads = 0
    let qrScans = 0
    resumes.forEach((resume) => {
      if (isPublicResume(resume)) {
        published += 1
        views += toCount(resume.views)
        qrScans += toCount(resume.qrScans)
      }
      downloads += toCount(resume.downloads)
    })
    return {
      totalUsers: Array.isArray(users) ? users.length : null,
      disabledUsers: Array.isArray(users) ? users.filter((user) => user.disabled).length : null,
      total: resumes.length,
      published,
      drafts: resumes.length - published,
      views,
      downloads,
      qrScans,
    }
  }, [resumes, users])

  const recent = useMemo(() => sortByRecent(resumes).slice(0, 5), [resumes])
  const latestFeedback = useMemo(() => (Array.isArray(feedback) ? feedback.slice(0, 5) : []), [feedback])
  const recentUsers = useMemo(() => {
    if (!Array.isArray(users)) return null
    return [...users]
      .sort((a, b) => userSignedInAt(b) - userSignedInAt(a))
      .slice(0, 5)
  }, [users])

  const showSkeletons = loading && resumes.length === 0 && feedback.length === 0

  return (
    <div>
      <header className="admin-header">
        <div className="admin-header-text">
          <p className="admin-eyebrow">
            <Activity size={14} /> Admin overview
          </p>
          <h1 className="admin-title">Console</h1>
          <p className="admin-subtitle">
            Live counts across users, resumes and feedback. User data is read through the
            verified admin API; resumes and feedback through Firestore rules that only an
            admin claim can satisfy.
          </p>
        </div>
      </header>

      {!firebaseConfigured && (
        <AdminNote tone="warning">
          Firebase is not configured in this build, so no cloud data will load.
        </AdminNote>
      )}

      {error && resumes.length === 0 && feedback.length === 0 ? (
        <AdminState
          icon={FileText}
          title="Admin data unavailable"
          text={error}
          action={
            <button className="admin-btn admin-btn-primary" type="button" onClick={handleRetry}>
              <RefreshCw size={16} /> Try again
            </button>
          }
        />
      ) : (
        <>
          {error && <AdminNote tone="warning">{error} Showing the data loaded earlier.</AdminNote>}

          <section className="admin-section" aria-labelledby="admin-summary-title">
            <AdminSectionHead icon={Activity} title="Users & resumes" note="Across all users" />
            <div className="admin-stat-grid admin-stat-grid-4">
              <AdminStat
                label="Total users"
                value={summary.totalUsers === null ? '—' : summary.totalUsers}
                hint={summary.totalUsers === null ? 'Admin API unavailable' : `${summary.disabledUsers} disabled`}
                icon={Users}
                tone="violet"
              />
              <AdminStat label="Total resumes" value={summary.total} hint="All users" icon={FileText} tone="blue" />
              <AdminStat label="Published" value={summary.published} hint="Public links live" icon={Globe} tone="green" />
              <AdminStat label="Drafts" value={summary.drafts} hint="Still private" icon={Lock} tone="amber" />
            </div>
          </section>

          <section className="admin-section" aria-labelledby="admin-engagement-title">
            <AdminSectionHead icon={Eye} title="Engagement" note="Recorded counters only" />
            <div className="admin-stat-grid admin-stat-grid-4">
              <AdminStat label="Views" value={summary.views} hint="On published resumes" icon={Eye} tone="blue" />
              <AdminStat label="Downloads" value={summary.downloads} hint="PDF + docx exports" icon={Download} tone="green" />
              <AdminStat label="QR scans" value={summary.qrScans} hint="QR code visits" icon={QrCode} tone="violet" />
              <AdminStat label="Feedback" value={feedback.length} hint="Submissions received" icon={MessageSquare} tone="amber" />
            </div>
          </section>

          <section className="admin-split">
            <section className="admin-section admin-panel" aria-labelledby="admin-activity-title">
              <AdminSectionHead icon={LogIn} title="Recent user activity" note="Newest sign-ins">
                {Array.isArray(users) && users.length > 5 && (
                  <Link className="admin-section-link" to="/admin/users">
                    View all {users.length}
                  </Link>
                )}
              </AdminSectionHead>
              {recentUsers === null ? (
                <AdminEmpty
                  icon={Users}
                  text="User activity is unavailable — it requires the admin users API and a configured service account."
                />
              ) : recentUsers.length > 0 ? (
                <div className="admin-rows">
                  {recentUsers.map((user) => (
                    <article className="admin-row" key={user.uid}>
                      <span className="admin-row-icon">
                        <Users size={16} />
                      </span>
                      <div className="admin-row-main">
                        <div className="admin-row-head">
                          <p className="admin-row-name">{userLabel(user)}</p>
                          <span className={`admin-badge ${user.disabled ? '' : 'is-public'}`}>
                            {user.disabled ? 'Disabled' : 'Active'}
                          </span>
                        </div>
                        <p className="admin-row-meta">
                          Signed in {relativeTime(userSignedInAt(user))} · {shortUid(user.uid)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <AdminEmpty text="No Firebase users found yet." />
              )}
            </section>

            <section className="admin-section admin-panel" aria-labelledby="admin-feedback-title">
              <AdminSectionHead icon={MessageSquare} title="Latest feedback" note="Newest first">
                {feedback.length > 5 && (
                  <Link className="admin-section-link" to="/admin/feedback">
                    View all {feedback.length}
                  </Link>
                )}
              </AdminSectionHead>
              {latestFeedback.length > 0 ? (
                <div className="admin-rows">
                  {latestFeedback.map((item) => (
                    <article className="admin-row" key={item.id}>
                      <span className="admin-row-icon">
                        <MessageSquare size={16} />
                      </span>
                      <div className="admin-row-main">
                        <div className="admin-row-head">
                          <p className="admin-row-name">{item.name || 'Anonymous'}</p>
                          <span className="admin-row-uid">{shortUid(item.userId)}</span>
                        </div>
                        <p className="admin-row-meta">{relativeTime(item.createdAt)}</p>
                        <p className="admin-row-snippet">
                          {typeof item.message === 'string' ? item.message : ''}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <AdminEmpty text="No feedback submitted yet." />
              )}
            </section>
          </section>

          <section className="admin-section admin-panel" aria-labelledby="admin-recent-title">
            <AdminSectionHead icon={Clock} title="Recent resumes" note="Updated last">
              {resumes.length > 5 && (
                <Link className="admin-section-link" to="/admin/resumes">
                  View all {resumes.length}
                </Link>
              )}
            </AdminSectionHead>
            {showSkeletons ? (
              <div className="admin-rows" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <div className="admin-row admin-row-skeleton" key={index} />
                ))}
              </div>
            ) : recent.length > 0 ? (
              <div className="admin-rows">
                {recent.map((resume) => {
                  const publicResume = isPublicResume(resume)
                  return (
                    <article className="admin-row" key={resume.id}>
                      <span className={`admin-row-icon ${publicResume ? 'is-public' : ''}`}>
                        <FileText size={16} />
                      </span>
                      <div className="admin-row-main">
                        <div className="admin-row-head">
                          <p className="admin-row-name">{resumeTitle(resume)}</p>
                          <span className={`admin-badge ${publicResume ? 'is-public' : ''}`}>
                            {publicResume ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="admin-row-meta">
                          {templateName(resume)} · {resumeTypeOf(resume) === 'experienced' ? 'Experienced' : 'Fresher'} ·{' '}
                          {relativeTime(resume.updatedAt)}
                        </p>
                      </div>
                      <QrCode size={14} className="admin-row-icon-svg" />
                    </article>
                  )
                })}
              </div>
            ) : (
              <AdminEmpty text="No resumes have been created yet." />
            )}
          </section>
        </>
      )}
    </div>
  )
}
