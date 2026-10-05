import { defaultResumeName } from './resumeStorage'
import { calculateAtsScore } from '../services/atsScore'

// Pure helpers that turn the single ownership-scoped resume list the dashboard
// already has into display values. No Firestore access lives here: every number
// comes from fields stored on the user's own resume documents, so nothing on the
// dashboard can be invented or guessed.

// Counters were added after the first resumes were stored, so a missing or
// corrupted value means "never incremented" rather than a real zero.
export function toCount(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0
}

export function isPublicResume(resume) {
  return resume?.isPublic === true
}

export function resumeTypeOf(resume) {
  return resume?.resumeType === 'experienced' ? 'experienced' : 'fresher'
}

export function resumeTitle(resume) {
  if (!resume) return 'Untitled resume'
  const stored = typeof resume.name === 'string' ? resume.name.trim() : ''
  if (stored) return stored
  try {
    const fallback = defaultResumeName(resume.formData)
    return fallback && fallback.trim() ? fallback.trim() : 'Untitled resume'
  } catch {
    return 'Untitled resume'
  }
}

function timeValue(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis()
    return Number.isFinite(millis) ? millis : 0
  }
  const millis = new Date(value).getTime()
  return Number.isFinite(millis) ? millis : 0
}

export function lastUpdatedAt(resume) {
  return timeValue(resume?.updatedAt) || timeValue(resume?.createdAt)
}

// Newest first, with a deterministic tie-break so the order never flickers
// between two documents saved in the same millisecond.
export function sortByRecent(resumes) {
  return [...resumes].sort((a, b) => {
    const diff = lastUpdatedAt(b) - lastUpdatedAt(a)
    if (diff !== 0) return diff
    return String(a?.id || '').localeCompare(String(b?.id || ''))
  })
}

export function recentResumes(resumes, limit = 5) {
  return sortByRecent(resumes).slice(0, limit)
}

// Views and QR scans are only ever incremented on public resumes, so the leader
// board is built from published documents.
export function mostViewedResume(resumes) {
  const published = resumes.filter(isPublicResume)
  if (!published.length) return null

  let best = null
  let bestViews = 0
  published.forEach((resume) => {
    const views = toCount(resume.views)
    if (views > bestViews) {
      best = resume
      bestViews = views
    }
  })

  if (!best) return null
  return { resume: best, views: bestViews }
}

export function summarizeResumes(resumes) {
  const list = Array.isArray(resumes) ? resumes : []
  let published = 0
  let views = 0
  let downloads = 0
  let qrScans = 0

  list.forEach((resume) => {
    if (isPublicResume(resume)) published += 1
    // Totals follow the counters the app actually maintains: views and QR scans
    // only grow on published resumes, downloads only grow for the owner.
    if (isPublicResume(resume)) {
      views += toCount(resume.views)
      qrScans += toCount(resume.qrScans)
    }
    downloads += toCount(resume.downloads)
  })

  const leader = mostViewedResume(list)
  return {
    total: list.length,
    published,
    drafts: list.length - published,
    views,
    downloads,
    qrScans,
    mostViewed: leader ? leader.resume : null,
    mostViewedCount: leader ? leader.views : 0,
    hasActivity: views + downloads + qrScans > 0,
  }
}

// Completion reuses the section detection the ATS service already performs, so
// the percentage always matches what the editor/ATS panel reports for that
// resume. It is never a placeholder value.
export function resumeCompletion(resume) {
  if (!resume?.formData) return null

  const result = calculateAtsScore(resume.formData, resumeTypeOf(resume))
  const sections = Array.isArray(result?.sections) ? result.sections : []
  if (!sections.length) return null

  const filled = sections.filter((section) => section.present).length
  return {
    percent: Math.round((filled / sections.length) * 100),
    filled,
    total: sections.length,
    missing: Array.isArray(result.missing) ? result.missing : [],
    atsScore: typeof result.total === 'number' ? result.total : null,
    atsLevel: result.level || '',
  }
}