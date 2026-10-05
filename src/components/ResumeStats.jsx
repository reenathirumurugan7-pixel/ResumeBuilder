import { Eye, Folder, Globe, Lock, Trophy, Download, QrCode } from 'lucide-react'
import { defaultResumeName } from '../utils/resumeStorage'
import './ResumeStats.css'

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function ResumeStats({ resumes = [], loading = false }) {
  if (loading) {
    return (
      <section className="resume-stats" aria-label="Resume statistics">
        <div className="resume-stats-head">
          <h2 className="resume-stats-title">Your Resumes at a Glance</h2>
          <p className="resume-stats-subtitle">Loading your statistics...</p>
        </div>
        <div className="resume-stats-grid">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div className="resume-stat-card resume-stat-skeleton" key={i} />
          ))}
        </div>
      </section>
    )
  }

  const list = Array.isArray(resumes) ? resumes : []
  const total = list.length
  const published = list.filter((r) => r.isPublic === true)
  const publishedCount = published.length
  const draftCount = total - publishedCount
  const totalViews = published.reduce((sum, r) => sum + toNumber(r.views), 0)
  // Downloads happen on any resume (public or private), so they are totalled
  // across the whole library rather than only published documents.
  const totalDownloads = list.reduce((sum, r) => sum + toNumber(r.downloads), 0)
  const totalQrScans = published.reduce((sum, r) => sum + toNumber(r.qrScans), 0)

  const mostViewed = published.reduce((best, r) => {
    if (!best || toNumber(r.views) > toNumber(best.views)) return r
    return best
  }, null)
  const mostViewedViews = mostViewed ? toNumber(mostViewed.views) : 0
  const mostViewedName = mostViewed
    ? (mostViewed.name || defaultResumeName(mostViewed.formData) || 'My Resume')
    : ''

  const cards = [
    {
      key: 'total',
      icon: <Folder size={20} />,
      tone: 'total',
      label: 'Total Resumes',
      value: <span className="resume-stat-value">{total}</span>,
    },
    {
      key: 'published',
      icon: <Globe size={20} />,
      tone: 'published',
      label: 'Published Resumes',
      value: <span className="resume-stat-value">{publishedCount}</span>,
    },
    {
      key: 'draft',
      icon: <Lock size={20} />,
      tone: 'draft',
      label: 'Draft Resumes',
      value: <span className="resume-stat-value">{draftCount}</span>,
    },
    {
      key: 'views',
      icon: <Eye size={20} />,
      tone: 'views',
      label: 'Total Resume Views',
      value: <span className="resume-stat-value">{totalViews}</span>,
    },
    {
      key: 'downloads',
      icon: <Download size={20} />,
      tone: 'downloads',
      label: 'Total Downloads',
      value: <span className="resume-stat-value">{totalDownloads}</span>,
    },
    {
      key: 'qr-scans',
      icon: <QrCode size={20} />,
      tone: 'qr-scans',
      label: 'QR Scans',
      value: <span className="resume-stat-value">{totalQrScans}</span>,
    },
    {
      key: 'most-viewed',
      icon: <Trophy size={20} />,
      tone: 'most-viewed',
      label: 'Most Viewed Resume',
      value: mostViewedViews > 0 ? (
        <span className="resume-stat-value">{mostViewedViews} <span className="resume-stat-unit">views</span></span>
      ) : (
        <span className="resume-stat-empty">No views yet</span>
      ),
    },
  ]

  return (
    <section className="resume-stats" aria-label="Resume statistics">
      <div className="resume-stats-head">
        <h2 className="resume-stats-title">Your Resumes at a Glance</h2>
        <p className="resume-stats-subtitle">
          Track your resume library, publishing status, and public reach.
        </p>
      </div>

      <div className="resume-stats-grid">
        {cards.map((card) => (
          <div className={`resume-stat-card resume-stat-${card.tone}`} key={card.key}>
            <div className={`resume-stat-icon resume-stat-icon-${card.tone}`}>{card.icon}</div>
            <span className="resume-stat-label">{card.label}</span>
            {card.value}
            {card.key === 'most-viewed' && mostViewedViews > 0 && (
              <span className="resume-stat-name" title={mostViewedName}>{mostViewedName}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default ResumeStats