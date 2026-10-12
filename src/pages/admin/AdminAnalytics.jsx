import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, Eye, FileText, Globe, Lock, QrCode, RefreshCw } from 'lucide-react'
import { getAllResumes } from '../../services/adminFirestore'
import { firebaseConfigured } from '../../firebase'
import {
  isPublicResume,
  resumeCompletion,
  resumeTitle,
  resumeTypeOf,
  sortByRecent,
  toCount,
} from '../../utils/resumeMetrics'
import templates from '../../data/templates'
import { shortUid } from './utils'
import { AdminEmpty, AdminNote, AdminSectionHead, AdminStat, AdminState } from './State'
import './Admin.css'

function templateName(templateId) {
  if (!templateId) return 'Default layout'
  const template = templates.find((item) => item.id === templateId)
  return template?.name || 'Custom layout'
}

function buildAnalytics(rows) {
  let published = 0
  let views = 0
  let downloads = 0
  let qrScans = 0
  const byType = { fresher: 0, experienced: 0 }
  const byTemplate = new Map()

  rows.forEach((resume) => {
    if (isPublicResume(resume)) {
      published += 1
      views += toCount(resume.views)
      qrScans += toCount(resume.qrScans)
    }
    downloads += toCount(resume.downloads)
    byType[resumeTypeOf(resume)] += 1
    const templateId = resume?.config?.templateId
    const name = templateName(templateId)
    byTemplate.set(name, (byTemplate.get(name) || 0) + 1)
  })

  return {
    totals: {
      total: rows.length,
      published,
      drafts: rows.length - published,
      views,
      downloads,
      qrScans,
    },
    byType,
    byTemplate: [...byTemplate.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export default function AdminAnalytics() {
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getAllResumes()
      .then((docs) => {
        if (active) setResumes(Array.isArray(docs) ? docs : [])
      })
      .catch(() => {
        if (active) setError('We could not load resume analytics right now.')
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
      .catch(() => setError('We could not load resume analytics right now.'))
      .finally(() => setLoading(false))
  }

  const analytics = useMemo(() => buildAnalytics(resumes), [resumes])

  const completion = useMemo(() => {
    const results = []
    resumes.forEach((resume) => {
      if (!resume?.formData) return
      try {
        const info = resumeCompletion(resume)
        if (info) results.push(info)
      } catch {
        // Skip documents whose shape the completion scorer cannot read.
      }
    })
    if (!results.length) return null
    const averagePercent = Math.round(results.reduce((sum, item) => sum + item.percent, 0) / results.length)
    const scored = results.filter((item) => typeof item.atsScore === 'number' && item.atsScore > 0)
    const averageAts = scored.length
      ? Math.round(scored.reduce((sum, item) => sum + item.atsScore, 0) / scored.length)
      : null
    return { averagePercent, averageAts, scored: results.length }
  }, [resumes])

  const topPublished = useMemo(
    () =>
      sortByRecent(resumes)
        .filter(isPublicResume)
        .sort((a, b) => toCount(b.views) - toCount(a.views))
        .slice(0, 10),
    [resumes],
  )

  const maxTemplateCount = Math.max(1, analytics.byTemplate.length ? analytics.byTemplate[0].count : 1)

  return (
    <div>
      <header className="admin-header">
        <div className="admin-header-text">
          <p className="admin-eyebrow">
            <BarChart3 size={14} /> Admin analytics
          </p>
          <h1 className="admin-title">Usage Analytics</h1>
          <p className="admin-subtitle">
            Aggregations computed live from the stored resumes — nothing is cached or invented.
          </p>
        </div>
      </header>

      {!firebaseConfigured && (
        <AdminNote tone="warning">
          Firebase is not configured in this build, so no cloud data will load.
        </AdminNote>
      )}

      {error ? (
        <AdminState
          icon={BarChart3}
          title="Analytics unavailable"
          text={error}
          action={
            <button className="admin-btn admin-btn-primary" type="button" onClick={handleRetry}>
              <RefreshCw size={16} /> Try again
            </button>
          }
        />
      ) : (
        <>
          <section className="admin-section" aria-labelledby="admin-analytics-summary-title">
            <AdminSectionHead icon={FileText} title="Totals" note="Across all users" />
            <div className="admin-stat-grid">
              <AdminStat label="Total resumes" value={analytics.totals.total} hint="All users" icon={FileText} tone="blue" />
              <AdminStat label="Published" value={analytics.totals.published} hint="Public links live" icon={Globe} tone="green" />
              <AdminStat label="Drafts" value={analytics.totals.drafts} hint="Still private" icon={Lock} tone="amber" />
              <AdminStat label="Views" value={analytics.totals.views} hint="On published resumes" icon={Eye} tone="blue" />
              <AdminStat label="Downloads" value={analytics.totals.downloads} hint="PDF + docx exports" icon={Download} tone="green" />
              <AdminStat label="QR scans" value={analytics.totals.qrScans} hint="QR code visits" icon={QrCode} tone="violet" />
            </div>
          </section>

          <section className="admin-split">
            <section className="admin-section admin-panel" aria-labelledby="admin-analytics-templates-title">
              <AdminSectionHead icon={BarChart3} title="Template popularity" note="Resumes per template" />
              {loading && resumes.length === 0 ? (
                <div className="admin-rows" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <div className="admin-row admin-row-skeleton" key={index} />
                  ))}
                </div>
              ) : analytics.byTemplate.length === 0 ? (
                <AdminEmpty text="No resumes to aggregate yet." />
              ) : (
                <div className="admin-bars">
                  {analytics.byTemplate.map((entry) => (
                    <div className="admin-bar-row" key={entry.name}>
                      <span className="admin-bar-label">{entry.name}</span>
                      <div className="admin-bar-track">
                        <span
                          className="admin-bar-fill"
                          style={{ width: `${Math.max(4, Math.round((entry.count / maxTemplateCount) * 100))}%` }}
                        />
                      </div>
                      <span className="admin-bar-value">{entry.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-section admin-panel" aria-labelledby="admin-analytics-completion-title">
              <AdminSectionHead icon={FileText} title="Completion & ATS" note="Across completed resumes" />
              {completion ? (
                <div className="admin-stat-grid admin-stat-grid-2">
                  <AdminStat label="Avg completion" value={`${completion.averagePercent}%`} hint={`${completion.scored} resumes scored`} icon={FileText} tone="green" />
                  <AdminStat label="Avg ATS score" value={completion.averageAts ?? '—'} hint="Only resumes with content" icon={BarChart3} tone="blue" />
                  <AdminStat label="Fresher resumes" value={analytics.byType.fresher} hint="Of all stored" icon={FileText} tone="blue" />
                  <AdminStat label="Experienced" value={analytics.byType.experienced} hint="Of all stored" icon={FileText} tone="amber" />
                </div>
              ) : (
                <AdminEmpty text="No resumes with saved content yet." />
              )}
            </section>
          </section>

          <section className="admin-section admin-panel" aria-labelledby="admin-analytics-top-title">
            <AdminSectionHead icon={Eye} title="Most viewed published resumes" note="Top 10 by views" />
            {topPublished.length === 0 ? (
              <AdminEmpty text="No published resume has recorded a view yet." />
            ) : (
              <div className="admin-table" role="table">
                <div className="admin-table-head admin-th-5" role="row">
                  <span role="columnheader">Resume</span>
                  <span role="columnheader">Owner</span>
                  <span role="columnheader">Views</span>
                  <span role="columnheader">Downloads</span>
                  <span role="columnheader">QR scans</span>
                </div>
                {topPublished.map((resume) => (
                  <div className="admin-table-row admin-th-5" role="row" key={resume.id}>
                    <span className="admin-table-name" role="cell" data-label="Resume">
                      {resumeTitle(resume)}
                      <span className="admin-row-meta">{templateName(resume?.config?.templateId)}</span>
                    </span>
                    <span role="cell" data-label="Owner" title={resume.userId}>
                      {shortUid(resume.userId)}
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
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}