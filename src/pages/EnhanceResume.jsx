import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, BarChart3, Briefcase, Check, CheckCircle, Eye, FileText, Folder,
  GraduationCap, Info, Plus, RefreshCw, Save, Shield, Sparkles, Star, Upload, X,
} from 'lucide-react'
import ScrollReveal from '../components/ScrollReveal'
import AtsScorePanel from '../components/AtsScorePanel'
import LiveResumePreview from '../components/LiveResumePreview'
import { SkeletonCard } from '../components/Skeleton'
import {
  claimGuestDrafts,
  createResume,
  defaultResumeName,
  generateId,
  getAllResumes,
  getResume,
  getResumeFromFirestore,
  getResumeInProgress,
  getUserResumesFromFirestore,
  saveResume,
  saveResumeToFirestore,
} from '../utils/resumeStorage'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../firebase'
import {
  analyzeResume,
  applyTextFixes,
  buildSectionSuggestions,
  safeText,
} from '../services/enhancement'
import { enhanceWithAI } from '../services/aiEnhancement'
import { parseResumeWithAI } from '../services/aiParsing'
import {
  MAX_RESUME_FILE_BYTES,
  RESUME_IMPORT_ACCEPT,
  RESUME_IMPORT_FORMAT_LABEL,
  ResumeFileError,
  extractResumeText,
  validateResumeFile,
} from '../utils/resumeFileParser'
import { parseResumeTextToFormData, hasSubstantialResumeText } from '../utils/resumeTextParser'
import { normalizeImportedFormData, findWeakResumeReason, ResumeImportError } from '../utils/resumeFormShape'
import { resolveConfig } from '../config/customize'
import './EnhanceResume.css'

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeFormData(fd, resumeType) {
  const src = fd && typeof fd === 'object' ? fd : {}
  const base = {
    personalInfo: {},
    education: [],
    skills: [],
    languages: [],
    projects: [],
    certifications: [],
    achievements: [],
  }
  if (resumeType === 'fresher') {
    base.careerObjective = ''
    base.internship = []
  } else {
    base.professionalSummary = ''
    base.workExperience = []
  }
  return {
    ...base,
    ...src,
    personalInfo: { ...base.personalInfo, ...(src.personalInfo || {}) },
  }
}

const SECTION_FIELD = {
  summary: (fd, type) => (type === 'fresher' ? 'careerObjective' : 'professionalSummary'),
  skills: () => 'skills',
  projects: () => 'projects',
  experience: (fd, type) => (type === 'fresher' ? 'internship' : 'workExperience'),
}

function sectionTitles(type) {
  return {
    summary: type === 'fresher' ? 'Career Objective' : 'Professional Summary',
    skills: 'Skills',
    projects: 'Projects',
    experience: type === 'fresher' ? 'Experience (Internship)' : 'Experience',
  }
}

function strengthColor(score) {
  if (score >= 85) return '#16A34A'
  if (score >= 70) return '#16A34A'
  if (score >= 55) return '#2563EB'
  if (score >= 40) return '#D97706'
  return '#DC2626'
}

// Every list-valued field in the resume schema. These must stay arrays: the
// editors and LiveResumePreview map over them directly.
const ARRAY_FIELDS = [
  'education', 'skills', 'languages', 'projects',
  'certifications', 'achievements', 'internship', 'workExperience',
]

function aiError(message, code, status) {
  const err = new Error(message)
  err.code = code || 'request-failed'
  if (status) err.status = status
  return err
}

// Which field inside an array entry holds the text the AI rewrites. Projects
// always use `description`; experience uses `description` for a fresher's
// internship and `responsibilities` for an experienced role.
function aiTextField(key, resumeType) {
  if (key === 'projects') return 'description'
  if (key === 'experience') return resumeType === 'fresher' ? 'description' : 'responsibilities'
  return null
}

// The array a section operates on, or [] when the field holds a scalar.
function sectionEntries(fd, key, resumeType) {
  if (!fd) return []
  if (key === 'projects') return Array.isArray(fd.projects) ? fd.projects : []
  if (key === 'experience') {
    const list = resumeType === 'fresher' ? fd.internship : fd.workExperience
    return Array.isArray(list) ? list : []
  }
  return []
}

// Maps one AI rewrite onto its own entry, so the array length, the entry order
// and every non-text field (titles, companies, dates, links) survive intact.
// Throws rather than returning a partial result: a response that cannot be
// matched one-to-one must never reach the resume.
function mergeAiTextIntoEntries(entries, textField, rewrites) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw aiError('There is nothing in this section to enhance.', 'bad-response')
  }
  if (!Array.isArray(rewrites) || rewrites.length !== entries.length) {
    throw aiError('The AI returned text that could not be matched to this section, so nothing was changed.', 'bad-response')
  }
  return entries.map((entry, index) => {
    const text = rewrites[index]
    if (typeof text !== 'string' || !text.trim()) {
      throw aiError('The AI returned an empty result for one of the entries, so nothing was changed.', 'bad-response')
    }
    return { ...entry, [textField]: text.trim() }
  })
}

function parseAiSkills(text) {
  if (typeof text !== 'string') {
    throw aiError('The AI did not return a skills list, so nothing was changed.', 'bad-response')
  }
  const list = text.split(',').map((s) => s.trim()).filter(Boolean)
  if (list.length === 0) {
    throw aiError('The AI returned an empty skills list, so nothing was changed.', 'bad-response')
  }
  return list
}

function parseAiSummary(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw aiError('The AI returned an empty summary, so nothing was changed.', 'bad-response')
  }
  return text.trim()
}

// Returns a human-readable problem description, or null when the data is sound.
function validateFormDataShape(fd) {
  if (!fd || typeof fd !== 'object' || Array.isArray(fd)) return 'the resume data is missing'
  // Every offending field is reported at once so the user can fix the document
  // in a single pass instead of discovering one broken list per save attempt.
  const problems = []
  for (const field of ARRAY_FIELDS) {
    if (fd[field] !== undefined && !Array.isArray(fd[field])) {
      problems.push(`"${field}" is a ${typeof fd[field]} but must be a list`)
    }
  }
  return problems.length ? problems.join('; ') : null
}

// Drops anything that is not a list so a malformed value can never reach a
// component that maps over it. Used for the preview only; saving is blocked
// outright by validateFormDataShape.
function repairFormDataShape(fd) {
  if (!fd || typeof fd !== 'object' || Array.isArray(fd)) return {}
  const out = { ...fd }
  for (const field of ARRAY_FIELDS) {
    if (out[field] !== undefined && !Array.isArray(out[field])) out[field] = []
  }
  return out
}

// ---------------------------------------------------------------- import gate
//
// The Gemini pass is a refinement of the on-device parse, never a replacement
// for it. A degraded answer can be perfectly well formed and still useless: a
// skill in place of the candidate's name, the contact block echoed into the
// summary, a project filed as an internship. Those all pass the shape check
// above, so the import compares how much usable content each answer carries and
// only lets the AI result through when it is not thinner than the parse that is
// already known to be good.

function importContentScore(formData) {
  const fd = formData && typeof formData === 'object' ? formData : {}
  const info = fd.personalInfo && typeof fd.personalInfo === 'object' ? fd.personalInfo : {}
  let score = 0
  if (info.fullName) score += 1
  if (info.email) score += 1
  if (info.phone) score += 1
  for (const field of ARRAY_FIELDS) {
    const list = Array.isArray(fd[field]) ? fd[field] : []
    if (list.length) score += 1
  }
  return score
}

// A candidate "name" that is one of the candidate's own skills is a field the
// model filled with the wrong value, not a name.
function nameLooksWrong(formData) {
  const fd = formData && typeof formData === 'object' ? formData : {}
  const info = fd.personalInfo && typeof fd.personalInfo === 'object' ? fd.personalInfo : {}
  const name = typeof info.fullName === 'string' ? info.fullName.trim().toLowerCase() : ''
  if (!name) return false
  const skills = Array.isArray(fd.skills) ? fd.skills : []
  return skills.some((skill) => String(skill || '').trim().toLowerCase() === name)
}

/**
 * Chooses which parse of an uploaded document reaches the editor.
 *
 * @param {{formData: object, resumeType: string}} offline The on-device parse.
 * @param {{formData: object}|null} ai The AI answer, or null when unavailable.
 * @returns {{source: object, usedAI: boolean, warning: string}}
 */
function chooseImportSource(offline, ai) {
  if (!ai || !ai.formData) return { source: offline, usedAI: false, warning: '' }

  const offlineScore = importContentScore(offline.formData)
  // A name that is one of the candidate's own skills is a field the model filled
  // with the wrong value, so it counts against the answer rather than for it. It
  // is not an outright rejection: when the on-device read found nothing at all,
  // a usable AI answer still beats an empty editor.
  const wrongName = nameLooksWrong(ai.formData)
  const aiScore = importContentScore(ai.formData) - (wrongName ? 1 : 0)

  if (aiScore < offlineScore) {
    const reasons = []
    if (wrongName) reasons.push('the name matched one of the listed skills')
    reasons.push('it carried less usable content than the on-device read')
    return {
      source: offline,
      usedAI: false,
      warning: `The AI answer was not used because ${reasons.join(' and ')}. The on-device parse was kept instead.`,
    }
  }
  return {
    source: { formData: ai.formData, resumeType: offline.resumeType },
    usedAI: true,
    warning: wrongName ? 'The AI answer looks incomplete: check the name and contact details before saving.' : '',
  }
}

// Turns a failed AI request into a short, specific message. The category is
// derived from the error code enhanceWithAI() sets plus the HTTP status, so a
// sign-in problem is never reported as a generic failure.
function describeAiError(err) {
  const code = (err && err.code) || ''
  const status = err && err.status
  const message = (err && err.message) || 'Please try again.'
  // Titles are keyed to what /api/ai/enhance actually returns: 401 for a bad
  // session, 429 for the rate limiter (and Gemini's own limit), 504 for its
  // timeout, and 500/502/503 for a missing key, a retired model, an empty or
  // filtered completion and upstream failures. Those already carry an
  // explanatory message from the server, so the title stays general and the
  // message is passed through untouched.
  if (code === 'auth-required') {
    return { title: 'Sign-in required', message, mode: 'info' }
  }
  if (code === 'timeout' || code === 'network') {
    return { title: 'Connection problem', message, mode: 'error' }
  }
  if (code === 'bad-response') {
    return { title: 'Unusable AI response', message, mode: 'error' }
  }
  if (code === 'not-configured') {
    return { title: 'AI not configured', message, mode: 'error' }
  }
  if (status === 429) {
    return { title: 'Rate limit reached', message, mode: 'error' }
  }
  if (status === 504) {
    return { title: 'AI request timed out', message, mode: 'error' }
  }
  if (status === 400 || status === 403 || status === 404 || status === 500 || status === 502 || status === 503) {
    return { title: 'AI service problem', message, mode: 'error' }
  }
  return { title: 'AI request failed', message, mode: 'error' }
}

// Maps a failed save onto something the user can act on. The Firebase code and
// message are never surfaced: a rules rejection can quote the document path, the
// collection and the rule that refused it, so only the fixed strings below are
// shown. Anything unrecognised falls through to the generic line rather than
// leaking the original error.
function describeSaveError(err) {
  const code = (err && err.code) || ''
  if (code === 'permission-denied' || code === 'unauthorized') {
    return { message: "You don't have permission to modify this resume.", mode: 'error' }
  }
  if (code.startsWith('auth/')) {
    return { message: 'Please sign in to save this resume.', mode: 'error' }
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') {
    return { message: 'Network problem. Check your connection and try again.', mode: 'error' }
  }
  if (code === 'invalid-argument' || code === 'bad-response') {
    return { message: 'This resume could not be validated. Please review it and try again.', mode: 'error' }
  }
  return { message: 'Could not save the resume. Please try again.', mode: 'error' }
}

function SectionCard({ def, sug, applied, onGenerate, onApply, onUndo, pending }) {
  const { icon, title, desc } = def
  const hasData = !!sug && !!sug.hasData
  const changes = (sug && sug.changes) || []
  const actionable = changes.filter((c) => c.before !== c.after)
  const manualOnly = changes.length > 0 && actionable.length === 0

  return (
    <div className="enh-section-card">
      <div className="enh-section-head">
        <div className="enh-section-title-wrap">
          <div className="enh-section-icon">{icon}</div>
          <div>
            <h3 className="enh-section-title">{title}</h3>
            <p className="enh-section-desc">{desc}</p>
          </div>
        </div>
        <div className="enh-section-actions">
          {applied && (
            <span className="enh-applied-chip"><Check size={12} /> Applied</span>
          )}
          {hasData && (
            <button
              className="enh-icon-btn"
              onClick={onGenerate}
              disabled={pending}
              aria-label={`Regenerate ${title} with AI`}
              title={pending ? 'Generating with AI...' : 'Regenerate with AI'}
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="enh-section-body">
        {!hasData ? (
          <p className="enh-section-empty">
            Nothing to enhance yet. Add {title.toLowerCase()} details in the resume editor first.
          </p>
        ) : changes.length > 0 ? (
          <div className="enh-diff-list">
            {changes.map((c, i) => (
              <div className="enh-diff-row" key={i}>
                {c.section && <div className="enh-diff-section">{c.section}</div>}
                <div className="enh-diff-pair">
                  <span className="enh-diff-before" title={c.before}>{c.before}</span>
                  <span className="enh-diff-arrow" aria-hidden="true">→</span>
                  <span className="enh-diff-after" title={c.after}>{c.after}</span>
                </div>
                <div className="enh-diff-reason">{c.reason}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="enh-section-good">
            <CheckCircle size={16} className="enh-section-good-icon" />
            <p>This section looks well-written. No automatic improvements suggested.</p>
          </div>
        )}

        {manualOnly && (
          <p className="enh-section-manual-hint">
            The suggestions above require your judgment — review the wording and then apply.
          </p>
        )}

        {actionable.length > 0 && (
          <div className="enh-section-actions-row">
            <button className="btn btn-primary btn-sm" onClick={onApply}>
              <CheckCircle size={14} /> Apply Enhancement
            </button>
          </div>
        )}

        {applied && (
          <div className="enh-applied-bar">
            <span className="enh-applied-bar-text">
              <Check size={13} /> Applied to your resume. Save when you are done.
            </span>
            <button className="enh-undo-btn" onClick={onUndo}>Undo</button>
          </div>
        )}
      </div>
    </div>
  )
}

function StrengthCard({ strength, ats, grammar }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (strength.score / 100) * circumference
  const color = strengthColor(strength.score)
  return (
    <div className="enh-card">
      <h3 className="enh-card-title"><BarChart3 size={18} /> Resume Strength Score</h3>
      <div className="enh-strength-wrap">
        <div className="enh-strength-ring">
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle className="enh-strength-bg" cx="55" cy="55" r={radius} />
            <circle
              className="enh-strength-fg"
              cx="55"
              cy="55"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="enh-strength-label">
            <span className="enh-strength-num">{strength.score}</span>
            <span className="enh-strength-total">/100</span>
          </div>
        </div>
        <div className="enh-strength-info">
          <span className="enh-strength-level" style={{ color }}>{strength.label}</span>
          <div className="enh-strength-meta">
            <span className="enh-strength-meta-item"><Shield size={14} /> ATS Score {ats.total}</span>
            <span className="enh-strength-meta-item"><CheckCircle size={14} /> Grammar {grammar.clean ? 'Clean' : `${grammar.issues} issue${grammar.issues > 1 ? 's' : ''}`}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function GrammarCard({ grammar, onFix }) {
  const issues = grammar.issues
  const detail = grammar.sections.filter((s) => s.issues.length > 0)
  return (
    <div className="enh-card">
      <h3 className="enh-card-title">
        <FileText size={18} /> Grammar Check
        <span className={`enh-card-count ${issues === 0 ? 'ok' : ''}`}>{issues}</span>
      </h3>
      {issues === 0 ? (
        <div className="enh-section-good">
          <CheckCircle size={16} className="enh-section-good-icon" />
          <p>No grammar issues detected.</p>
        </div>
      ) : (
        <>
          <div className="enh-grammar-list">
            {detail.map((s, i) => (
              <div className="enh-grammar-section" key={i}>
                <div className="enh-grammar-head">
                  <span className="enh-grammar-label">{s.label}</span>
                  <span className="enh-grammar-count">{s.issues.length}</span>
                </div>
                <ul className="enh-grammar-items">
                  {s.issues.map((it, j) => (
                    <li className="enh-grammar-item" key={j}>{it.message}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm enh-grammar-fix" onClick={onFix}>
            <CheckCircle size={14} /> Fix Common Issues
          </button>
        </>
      )}
    </div>
  )
}

function KeywordCard({ keywords, onAdd }) {
  return (
    <div className="enh-card">
      <h3 className="enh-card-title"><Sparkles size={18} /> Keyword Suggestions</h3>
      {keywords.length === 0 ? (
        <div className="enh-section-good">
          <CheckCircle size={16} className="enh-section-good-icon" />
          <p>Common technical keywords already appear in your resume.</p>
        </div>
      ) : (
        <>
          <p className="enh-card-text">
            Add missing keywords only if they truthfully describe your skills.
          </p>
          <div className="enh-keyword-list">
            {keywords.map((kw) => (
              <div className="enh-keyword-row" key={kw}>
                <span className="enh-keyword-name">{kw}</span>
                <button
                  className="enh-keyword-add"
                  onClick={() => onAdd(kw)}
                  aria-label={`Add ${kw} to skills`}
                  title={`Add ${kw} to skills`}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// The three steps the importer moves through, so the user always knows whether
// the wait is file reading, parsing, or building the form.
const IMPORT_STAGE_LABELS = {
  reading: 'Reading resume...',
  parsing: 'Parsing resume...',
  preparing: 'Preparing resume...',
}

const IMPORT_STAGE_NOTES = {
  reading: 'Opening the file and extracting its text.',
  parsing: 'Finding each section of the resume.',
  preparing: 'Filling the resume form with what was found.',
}

const IMPORT_NAME_EXTENSION = /\.(pdf|docx|json)$/i

/**
 * The name of an imported resume is the name of the uploaded file with its
 * extension removed: "Reena Resume.pdf" becomes "Reena Resume". Nothing that
 * was detected inside the document may contribute to it, so an import never
 * renames itself after a candidate name, a skill, a company or a URL.
 *
 * @param {string} [fileName] `File.name` of the uploaded document.
 * @returns {string} The base name, or '' when there is nothing usable.
 */
function resumeNameFromFileName(fileName) {
  const raw = typeof fileName === 'string' ? fileName.trim() : ''
  if (!raw) return ''
  return raw.replace(IMPORT_NAME_EXTENSION, '').trim()
}

function ImportResumeCard({ stage, report, error, busy, onPick, variant }) {
  const isCard = variant === 'card'
  return (
    <div className={isCard ? 'enh-choose-card' : 'enh-card enh-import-panel'}>
      <div className="enh-choose-icon"><Upload size={isCard ? 36 : 28} /></div>
      <h3 className="enh-choose-title">Upload Resume</h3>
      <p className="enh-choose-desc">
        Import a resume from a file and review it before you save anything.
      </p>

      <div className="enh-import-formats">
        <span className="enh-import-formats-label">{RESUME_IMPORT_FORMAT_LABEL}</span>
        <span className="enh-import-formats-size">Max {Math.round(MAX_RESUME_FILE_BYTES / (1024 * 1024))} MB</span>
      </div>

      <button className="btn btn-primary btn-sm enh-import-button" onClick={onPick} disabled={busy}>
        <Upload size={14} /> {busy ? 'Working...' : 'Choose File'}
      </button>

      {stage && (
        <div className="enh-import-status" role="status" aria-live="polite">
          <span className="enh-import-spinner" />
          <div className="enh-import-status-text">
            <span className="enh-import-status-label">{IMPORT_STAGE_LABELS[stage]}</span>
            <span className="enh-import-status-note">{IMPORT_STAGE_NOTES[stage]}</span>
          </div>
        </div>
      )}

      {report && !stage && (
        <div className="enh-import-report" role="status" aria-live="polite">
          <div className="enh-import-line ok">
            <CheckCircle size={14} /> <span>{report.headline}</span>
          </div>
          {report.warnings.length > 0 && (
            <>
              <div className="enh-import-line warn">
                <AlertTriangle size={14} /> <span>Some details could not be detected</span>
              </div>
              <ul className="enh-import-warn-list">
                {report.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </>
          )}
          <p className="enh-import-hint">
            Review the resume in the editor, then press Save Changes. Nothing has been saved yet.
          </p>
        </div>
      )}

      {error && (
        <div className="enh-import-line error" role="alert">
          <AlertTriangle size={14} /> <span>{error}</span>
        </div>
      )}
    </div>
  )
}

function EnhanceResume() {
  const { user } = useAuth()
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(null)
  const [working, setWorking] = useState(null)
  const [original, setOriginal] = useState(null)
  const [suggested, setSuggested] = useState({})
  const [applied, setApplied] = useState({})
  const [viewMode, setViewMode] = useState('enhanced')
  const [saving, setSaving] = useState(false)
  const [aiPending, setAiPending] = useState({})
  const [notification, setNotification] = useState(null)
  const [signInNoticeDismissed, setSignInNoticeDismissed] = useState(false)
  const [importStage, setImportStage] = useState(null)
  const [importReport, setImportReport] = useState(null)
  const [importError, setImportError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const notificationTimer = useRef(null)
  const fileRef = useRef(null)

  const type = current && current.resumeType === 'experienced' ? 'experienced' : 'fresher'
  const titles = sectionTitles(type)
  const appliedCount = Object.keys(applied).length

  const notify = useCallback((message, mode = 'success') => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current)
    setNotification({ message, mode })
    notificationTimer.current = setTimeout(() => setNotification(null), 3500)
  }, [])

  const selectResume = useCallback((resume) => {
    const rtype = resume.resumeType === 'experienced' ? 'experienced' : 'fresher'
    const fd = normalizeFormData(resume.formData, rtype)
    setCurrent(resume)
    setWorking(cloneData(fd))
    setOriginal(cloneData(fd))
    setSuggested(buildSectionSuggestions(fd, rtype))
    setApplied({})
    setViewMode('enhanced')
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        let docs = []
        if (firebaseConfigured && user) {
          // Adopt anything drafted while signed out before reading local drafts.
          claimGuestDrafts()
          docs = await getUserResumesFromFirestore(user.uid)
        }
        const local = getAllResumes()
        const map = new Map()
        local.forEach((r) => map.set(r.id, r))
        docs.forEach((r) => map.set(r.id, r))
        const all = [...map.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        if (!active) return
        setResumes(all)
        // Deliberately no resume is auto-selected here. Opening Enhance Resume
        // must always land on an empty editor rather than restoring whatever was
        // edited last, so the working/original/suggested copies stay empty until
        // the user picks one (Continue, the dropdown, or an import). Loading the
        // list itself is unchanged: it backs the resume dropdown and the guest
        // draft adoption above.
      } catch {
        /* ignore load errors */
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [user])

  const analysis = useMemo(() => {
    if (!working || !type) return null
    return analyzeResume(working, type)
  }, [working, type])

  const previewConfig = useMemo(() => {
    if (!current) return null
    return { ...(current.config || {}), name: 'Template' }
  }, [current])

  const previewData = useMemo(() => {
    if (!current) return {}
    // Repaired rather than trusted: a malformed list must never reach the
    // preview, which maps over these fields directly.
    const out = repairFormDataShape(viewMode === 'original' ? original : working)
    return out
  }, [viewMode, original, working, current])

  const getSectionText = (key) => {
    if (!working) return ''
    if (key === 'skills') return (Array.isArray(working.skills) ? working.skills : []).join(', ')
    if (key === 'summary') return safeText(type === 'fresher' ? working.careerObjective : working.professionalSummary)
    if (key === 'projects') {
      const list = Array.isArray(working.projects) ? working.projects : []
      return list.map((p) => `${safeText(p.title)}: ${safeText(p.description)}`).join('\n\n')
    }
    if (key === 'experience') {
      const list = type === 'fresher'
        ? (Array.isArray(working.internship) ? working.internship : [])
        : (Array.isArray(working.workExperience) ? working.workExperience : [])
      const textKey = type === 'fresher' ? 'description' : 'responsibilities'
      return list.map((e) => `${safeText(e.jobTitle || e.role)} ${safeText(e.company)}: ${safeText(e[textKey])}`).join('\n\n')
    }
    return ''
  }

  // Commits an already-validated replacement value for `key`. The value is
  // built by the helpers above so it always matches the resume schema, and the
  // whole candidate document is re-checked before it replaces the working copy.
  const applyFieldValue = (key, nextValue) => {
    const field = SECTION_FIELD[key](working, type)
    const candidate = cloneData(working)
    candidate[field] = nextValue
    const problem = validateFormDataShape(candidate)
    if (problem) {
      throw aiError(`The AI result could not be applied safely (${problem}) Nothing was changed.`, 'bad-response')
    }
    setWorking(candidate)
    setApplied((prev) => ({ ...prev, [key]: true }))
    setSuggested((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleRegenerate = async (key) => {
    // Gemini can take several seconds. Without this guard the regenerate button
    // stays live for the whole request, so repeat clicks fire concurrent
    // enhance calls for the same section and burn the rate-limit quota.
    if (aiPending[key]) return
    // Every AI call is billed to a signed-in account, so ask before spending a
    // request rather than letting the server reject it anonymously.
    if (!user) {
      notify('Sign in to use AI enhancement. Everything else on this page works without an account.', 'info')
      return
    }

    const entries = sectionEntries(working, key, type)
    const textField = aiTextField(key, type)
    const hasSomethingToDo = textField
      ? entries.some((entry) => safeText(entry[textField]).trim())
      : key === 'skills'
        ? entries.length > 0
        : !!getSectionText(key).trim()

    if (!hasSomethingToDo) {
      notify(`Add some ${titles[key].toLowerCase()} content in the resume editor first.`, 'info')
      return
    }

    setAiPending((prev) => ({ ...prev, [key]: true }))
    try {
      if (textField) {
        // One request per entry, so every reply stays attached to the entry it
        // came from. A whole-section blob could not be split back apart safely.
        const rewrites = await Promise.all(
          entries.map((entry) => enhanceWithAI(safeText(entry[textField]), key)),
        )
        applyFieldValue(key, mergeAiTextIntoEntries(entries, textField, rewrites))
      } else if (key === 'skills') {
        applyFieldValue(key, parseAiSkills(await enhanceWithAI(getSectionText(key), 'skills')))
      } else {
        applyFieldValue(key, parseAiSummary(await enhanceWithAI(getSectionText(key), 'objective')))
      }
      notify(`${titles[key]} enhanced with AI. Review it in the preview, then save.`)
    } catch (err) {
      // A real AI attempt that failed is reported as such. Silently reverting to
      // the rule-based suggestions would hide sign-in, rate-limit and model
      // problems from the user. Rule-based suggestions stay available through
      // the diff list and its "Apply Enhancement" button.
      const { title, message, mode } = describeAiError(err)
      notify(`${title} — ${message}`, mode)
    } finally {
      setAiPending((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleApply = (key) => {
    const sug = suggested[key]
    const actionable = (sug && sug.changes ? sug.changes : []).some((c) => c.before !== c.after)
    if (!actionable) {
      notify(`${titles[key]} has only manual suggestions — review the wording first.`, 'info')
      return
    }
    const field = SECTION_FIELD[key](working, type)
    setWorking((prev) => {
      const fd = cloneData(prev)
      fd[field] = cloneData(sug.enhanced)
      return fd
    })
    setApplied((prev) => ({ ...prev, [key]: true }))
    setSuggested((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    notify(`${titles[key]} enhanced. Review it in the preview, then save.`)
  }

  const handleUndo = (key) => {
    if (!original) return
    const field = SECTION_FIELD[key](working, type)
    setWorking((prev) => {
      const fd = cloneData(prev)
      fd[field] = cloneData(original[field])
      return fd
    })
    setApplied((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    const sug = buildSectionSuggestions(cloneData(original), type)[key]
    if (sug) setSuggested((prev) => ({ ...prev, [key]: sug }))
    notify(`${titles[key]} restored to the original.`)
  }

  const handleAddKeyword = (kw) => {
    setWorking((prev) => {
      const fd = cloneData(prev)
      const skills = Array.isArray(fd.skills) ? fd.skills : []
      if (!skills.some((s) => safeText(s).toLowerCase() === kw.toLowerCase())) {
        fd.skills = [...skills, kw]
      }
      return fd
    })
    setSuggested((prev) => {
      const next = { ...prev }
      if (next.skills) delete next.skills
      return next
    })
    notify(`Added "${kw}" to Skills.`)
  }

  const handleFixGrammar = () => {
    if (!analysis || analysis.grammar.issues === 0) {
      notify('No auto-fixable grammar issues found.', 'info')
      return
    }
    const result = applyTextFixes(working, type)
    if (result.applied.length === 0) {
      notify('Issues found, but none could be fixed automatically. Check each node manually.', 'info')
      return
    }
    setWorking(result.formData)
    setSuggested((prev) => {
      const next = { ...prev }
      ;['summary', 'projects', 'experience'].forEach((k) => delete next[k])
      return next
    })
    notify(`Fixed grammar in ${result.applied.length} section${result.applied.length > 1 ? 's' : ''}.`)
  }

  const handleSave = async () => {
    if (!current) return
    // Refuse to persist a malformed document: neither localStorage nor
    // Firestore should ever receive a string where a list belongs.
    const problem = validateFormDataShape(working)
    if (problem) {
      notify(`Nothing was saved because the resume data is not valid (${problem})`, 'error')
      return
    }
    setSaving(true)
    try {
      if (!getResume(current.id)) {
        // A resume parsed from an uploaded file starts life as an in-memory
        // draft with no localStorage record. saveResume() creates it under the
        // same id, so the toolbar selection keeps pointing at this resume.
        saveResume(current.id, {
          resumeType: type,
          formData: working,
          qrCodeEnabled: !!current.qrCodeEnabled,
          config: current.config,
          name: current.name,
        })
      } else {
        saveResume(current.id, { formData: working, resumeType: type })
      }
      if (firebaseConfigured && user) {
        // A resume that has never reached Firestore is created with its current
        // visibility; later saves must not touch isPublic or the view counter.
        //
        // Visibility is read strictly, never inferred. A resume that has no
        // recorded visibility — an imported file, or a draft that only ever
        // existed in this browser — is private, so saving it can never publish
        // it. `!== false` used to read that same unknown as public and handed a
        // freshly imported resume a public URL the moment it was first saved.
        // Publishing stays an explicit act: only the Vault's Make Public /
        // Make Private control writes isPublic from false to true.
        const existing = await getResumeFromFirestore(current.id)
        await saveResumeToFirestore(
          current.id,
          {
            formData: working,
            resumeType: type,
            config: current.config,
            name: current.name,
            qrCodeEnabled: !!current.qrCodeEnabled,
            createdAt: current.createdAt,
            isPublic: current.isPublic === true,
          },
          { isNewResume: !existing },
        )
        notify('All enhancements saved to this resume.')
      } else {
        notify('Saved on this device only. Sign in to keep a cloud copy.', 'info')
      }
      setOriginal(cloneData(working))
      setApplied({})
      setSuggested(buildSectionSuggestions(cloneData(working), type))
    } catch (err) {
      const described = describeSaveError(err)
      notify(described.message, described.mode)
    } finally {
      setSaving(false)
    }
  }

  const handleSwitchResume = (e) => {
    const resume = resumes.find((r) => r.id === e.target.value)
    if (resume) selectResume(resume)
  }

  const handleContinue = () => {
    const local = getResumeInProgress()
    if (local) {
      setResumes((prev) => (prev.some((r) => r.id === local.id) ? prev : [local, ...prev]))
      selectResume(local)
      notify('Resume in progress loaded.')
    } else {
      notify('No resume in progress was found. Create a resume or open the Resume Vault first.', 'info')
    }
  }

  const handleUploadClick = () => {
    setImportError('')
    if (fileRef.current) fileRef.current.click()
  }

  // Builds an in-memory resume for an imported file. Nothing is written to
  // localStorage or Firestore here: the imported document lives only in the
  // working copy until the user presses Save.
  const applyImportedResume = (formData, resumeType, report, fileName) => {
    const fd = normalizeFormData(formData, resumeType)
    // Refuse to display anything that would break a component mapping over it.
    const problem = validateFormDataShape(fd)
    if (problem) {
      throw aiError(`The imported resume could not be read safely (${problem})`, 'bad-response')
    }
    const draft = {
      id: generateId(),
      resumeType,
      formData: fd,
      qrCodeEnabled: false,
      // A template so the live preview has something to render straight away.
      config: resolveConfig({}),
      // The uploaded file name is the resume's name. Anything detected inside the
      // document (a name, a skill, a company) is only form content.
      name: resumeNameFromFileName(fileName) || defaultResumeName(fd) || 'Imported Resume',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      views: 0,
      downloads: 0,
      qrScans: 0,
    }
    setResumes((prev) => [draft, ...prev.filter((r) => r.id !== draft.id)])
    setImportOpen(true)
    setImportReport(report)
    selectResume(draft)
    return draft
  }

  // ResumeBuilder's own JSON export: unchanged behaviour, it restores a resume
  // that was saved by this app and therefore still carries its id and template.
  const importJsonResume = (raw, fileName) => {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw aiError('That file is not valid JSON. Export the resume again from ResumeBuilder.', 'bad-response')
    }
    if (!parsed || !parsed.formData || !parsed.formData.personalInfo) {
      throw aiError('This JSON does not look like a ResumeBuilder resume.', 'bad-response')
    }
    const rtype = parsed.resumeType === 'experienced' ? 'experienced' : 'fresher'
    const fd = normalizeFormData(parsed.formData, rtype)
    const problem = validateFormDataShape(fd)
    if (problem) {
      throw aiError(`That JSON cannot be imported safely (${problem})`, 'bad-response')
    }
    // The same rule the PDF and DOCX path applies, and for the same reason: a name
    // and contact details on their own are a contact card, not a resume. Checked
    // before createResume so a thin file never reaches localStorage or Firestore.
    const weak = findWeakResumeReason(fd)
    if (weak) {
      throw aiError(weak, 'bad-response')
    }
    const resume = createResume({
      resumeType: rtype,
      formData: fd,
      qrCodeEnabled: !!parsed.qrCodeEnabled,
      config: parsed.config || null,
      // Same rule as PDF and DOCX: the uploaded file name wins over anything
      // detected inside the file.
      name: resumeNameFromFileName(fileName) || undefined,
    })
    setResumes((prev) => [resume, ...prev.filter((r) => r.id !== resume.id)])
    setImportOpen(false)
    setImportReport(null)
    selectResume(resume)
    notify('Imported ResumeBuilder JSON. You can now enhance it.')
  }

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return

    setImportError('')
    setImportReport(null)

    // Extension, size and MIME type are checked before any of the file is read,
    // so an unsupported document is never loaded into memory just to be rejected.
    const validation = validateResumeFile(file)
    if (!validation.ok) {
      setImportError(validation.message)
      notify(validation.message, 'error')
      return
    }

    setImportStage('reading')
    try {
      const extracted = await extractResumeText(file)

      if (extracted.kind === 'json') {
        importJsonResume(extracted.text, file.name)
        return
      }

      setImportStage('parsing')
      const offline = parseResumeTextToFormData(extracted.text)
      const warnings = [...extracted.warnings, ...offline.warnings]
      let ai = null

      // A file with neither recognisable resume content nor enough text to hold
      // any is rejected here, before the AI call: a blank or junk upload must not
      // cost an API round trip or reach the editor. Thin content that could still
      // be worth a second opinion is left to the AI fallback below.
      const weakReason = findWeakResumeReason(offline.formData)
      if (weakReason && !hasSubstantialResumeText(extracted.text)) {
        throw new ResumeImportError(weakReason)
      }

      // The Gemini pass is a refinement, never a requirement: any failure here
      // (signed out, rate limited, unusable JSON) falls back to the offline parse.
      if (user) {
        try {
          ai = await parseResumeWithAI(extracted.text, offline.resumeType)
          warnings.push(...ai.warnings)
        } catch (err) {
          warnings.push(`Parsed without AI — ${describeAiError(err).message}`)
        }
      } else {
        warnings.push('Parsed without AI. Sign in for a more accurate import of complex layouts.')
      }

      // Only a response that is at least as complete as the on-device parse is
      // allowed to overwrite it, so a poor AI answer cannot degrade the import.
      const chosen = chooseImportSource(offline, ai)
      const source = chosen.source
      const usedAI = chosen.usedAI
      if (chosen.warning) warnings.push(chosen.warning)

      setImportStage('preparing')
      const normalized = normalizeImportedFormData(source.formData, { resumeType: source.resumeType })
      warnings.push(...normalized.warnings)

      const label = source.resumeType === 'experienced' ? 'Experienced' : 'Fresher'
      applyImportedResume(
        normalized.formData,
        source.resumeType,
        {
          headline: `Imported ${label} resume from ${file.name} (${usedAI ? 'parsed with AI' : 'parsed on device'}).`,
          warnings: warnings.slice(0, 8),
        },
file.name,
      )
      notify('Resume imported. Review it in the editor, then press Save Changes.')
    } catch (err) {
      // A file that could not be read is a file problem, not an AI problem, so
      // its own message is shown as written instead of being routed through the
      // AI error describer.
      const message =
        err instanceof ResumeFileError ||
        err instanceof ResumeImportError ||
        (err && err.code === 'bad-response' && err.message)
          ? err.message
          : describeAiError(err).message
      setImportError(message)
      setImportReport(null)
      notify(message, 'error')
    } finally {
      setImportStage(null)
    }
  }

  const sections = [
    { key: 'summary', icon: <Star size={18} />, title: titles.summary, desc: 'Sharpen your opening statement with stronger language.' },
    { key: 'skills', icon: <FileText size={18} />, title: titles.skills, desc: 'Deduplicate skills and prepare keyword additions.' },
    { key: 'projects', icon: <Folder size={18} />, title: titles.projects, desc: 'Rewrite project descriptions with action verbs.' },
    { key: 'experience', icon: <Briefcase size={18} />, title: titles.experience, desc: 'Strengthen experience bullets with specific, active wording.' },
  ]

  return (
    <div className="enh-page">
      <div className="enh-hero">
        <div className="container">
          <ScrollReveal>
            <h1 className="enh-title">Enhance Resume</h1>
            <p className="enh-subtitle">
              Analyze your resume, improve each section, compare the changes, and save the enhanced
              version back — all in one place.
            </p>
          </ScrollReveal>
        </div>
      </div>

      <div className="container enh-body">
        {notification && (
          <div className={`enh-notification ${notification.mode}`} role="status">
            {notification.mode === 'success' ? <CheckCircle size={16} /> : <Info size={16} />}
            <span>{notification.message}</span>
            <button className="enh-notification-close" onClick={() => setNotification(null)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}

        {!loading && current && !user && !signInNoticeDismissed && (
          <div className="enh-notification info" role="status">
            <Info size={16} />
            <span>AI enhancement runs on your account, so it needs a sign-in. Analysis, suggestions and saving all work without one.</span>
            <Link className="btn btn-secondary btn-sm" to="/login">Sign In</Link>
            <button
              className="enh-notification-close"
              onClick={() => setSignInNoticeDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Import panel, reachable from the toolbar once a resume is open. */}
        {!loading && importOpen && current && (
          <div className="enh-import-wrap">
            <ImportResumeCard
              variant="panel"
              stage={importStage}
              report={importReport}
              error={importError}
              busy={!!importStage}
              onPick={handleUploadClick}
            />
          </div>
        )}

        {loading ? (
          <div className="enh-grid">
            <div className="enh-side">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="enh-main">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        ) : !current ? (          <div className="enh-choose">
            <ScrollReveal>
              <h2 className="section-title">Enhance an Existing Resume</h2>
              <p className="section-subtitle">
                Choose how you want to bring a resume into the enhancer.
              </p>
            </ScrollReveal>
            <div className="enh-choose-grid">
              <ScrollReveal delay={0}>
                <div
                  className="enh-choose-card"
                  role="button"
                  tabIndex={0}
                  onClick={handleContinue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleContinue() }
                  }}
                >
                  <div className="enh-choose-icon"><RefreshCw size={36} /></div>
                  <h3 className="enh-choose-title">Continue Current Resume</h3>
                  <p className="enh-choose-desc">Open the resume you were last editing and start enhancing it.</p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={100}>
                <Link to="/resume-vault" className="enh-choose-card">
                  <div className="enh-choose-icon"><Folder size={36} /></div>
                  <h3 className="enh-choose-title">Open Resume Vault</h3>
                  <p className="enh-choose-desc">Pick any saved resume from your vault to analyze and enhance.</p>
                </Link>
              </ScrollReveal>
              <ScrollReveal delay={200}>
                <ImportResumeCard
                  variant="card"
                  stage={importStage}
                  report={importReport}
                  error={importError}
                  busy={!!importStage}
                  onPick={handleUploadClick}
                />
              </ScrollReveal>
            </div>
          </div>
        ) : (
          <>
            <header className="enh-toolbar">
              <div className="enh-toolbar-left">
                <Link to="/" className="enh-back">
                  <ArrowLeft size={18} /> Back
                </Link>
                <select
                  className="enh-select"
                  value={current.id}
                  onChange={handleSwitchResume}
                  aria-label="Choose the resume to enhance"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || 'Untitled Resume'}
                    </option>
                  ))}
                </select>
                <span className={`enh-type-badge enh-type-${type}`}>
                  {type === 'experienced' ? <Briefcase size={13} /> : <GraduationCap size={13} />}
                  {type}
                </span>
              </div>
              <div className="enh-toolbar-right">
                <button
                  className="btn btn-secondary btn-sm enh-import-open"
                  onClick={() => setImportOpen((prev) => !prev)}
                >
                  <Upload size={15} /> Import Resume
                </button>
                {appliedCount > 0 && (
                  <span className="enh-pending">{appliedCount} section{appliedCount > 1 ? 's' : ''} enhanced — not yet saved</span>
                )}
                <button
                  className="btn btn-primary enh-save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="enh-save-inner">
                      <span className="enh-spinner"></span>
                      Saving...
                    </span>
                  ) : (
                    <>
                      <Save size={16} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </header>

            <div className="enh-grid">
              <aside className="enh-side">
                <div className="enh-side-title"><BarChart3 size={18} /> Resume Analysis</div>
                {analysis && (
                  <>
                    <StrengthCard strength={analysis.strength} ats={analysis.ats} grammar={analysis.grammar} />
                    <AtsScorePanel data={working} resumeType={type} />
                    <GrammarCard grammar={analysis.grammar} onFix={handleFixGrammar} />
                    <KeywordCard keywords={analysis.keywordSuggestions} onAdd={handleAddKeyword} />
                  </>
                )}
              </aside>

              <main className="enh-main">
                {sections.map((s, i) => (
                  <ScrollReveal key={s.key} delay={i * 40}>
                    <SectionCard
                      def={s}
                      sug={suggested[s.key]}
                      applied={!!applied[s.key]}
                      pending={!!aiPending[s.key]}
                      onGenerate={() => handleRegenerate(s.key)}
                      onApply={() => handleApply(s.key)}
                      onUndo={() => handleUndo(s.key)}
                    />
                  </ScrollReveal>
                ))}

                <ScrollReveal>
                  <section className="enh-card enh-preview-card">
                    <div className="enh-preview-head">
                      <h3 className="enh-card-title"><Eye size={18} /> Live Resume Preview</h3>
                      <div className="enh-compare-toggle" role="group" aria-label="Compare original and enhanced resume">
                        <button
                          className={`enh-compare-btn ${viewMode === 'enhanced' ? 'active' : ''}`}
                          onClick={() => setViewMode('enhanced')}
                        >
                          Enhanced
                        </button>
                        <button
                          className={`enh-compare-btn ${viewMode === 'original' ? 'active' : ''}`}
                          onClick={() => setViewMode('original')}
                        >
                          Original
                        </button>
                      </div>
                    </div>
                    <p className="enh-preview-note">
                      <Info size={13} /> Switch between <strong>Enhanced</strong> and <strong>Original</strong> to compare
                      before versus after.
                    </p>
                    {previewConfig ? (
                      <div className="enh-preview-scaler">
                        <LiveResumePreview
                          config={previewConfig}
                          data={previewData}
                          resumeType={type}
                          qrCodeEnabled={!!current.qrCodeEnabled}
                          resumeId={current.id}
                        />
                      </div>
                    ) : (
                      <div className="enh-preview-empty">
                        <p>No template selected for this resume.</p>
                        <Link className="btn btn-secondary btn-sm" to="/templates">Choose a Template</Link>
                      </div>
                    )}
                  </section>
                </ScrollReveal>
              </main>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={RESUME_IMPORT_ACCEPT}
        className="enh-file-input"
        onChange={handleFileChange}
      />
    </div>
  )
}

export default EnhanceResume
