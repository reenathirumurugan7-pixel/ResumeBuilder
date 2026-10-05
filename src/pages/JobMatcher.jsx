import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileSearch,
  Folder,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
  X,
} from 'lucide-react'
import {
  analyzeJobMatch,
  validateJobDescription,
  MAX_JOB_DESCRIPTION_LENGTH,
} from '../services/jobMatch'
import { analyzeSkillGapWithAI } from '../services/aiSkillGap'
import { calculateAtsScore } from '../services/atsScore'
import { getUserResumesFromFirestore } from '../utils/resumeStorage'
import { resumeTitle, resumeTypeOf, isPublicResume, lastUpdatedAt } from '../utils/resumeMetrics'
import { useAuth } from '../context/AuthContext'
import { Skeleton, SkeletonText } from '../components/Skeleton'
import './JobMatcher.css'

// Only the selected resume id and the pasted job description are kept, and only
// in this browser under a key namespaced per account. Nothing is written to
// Firestore, and the resume itself is never duplicated or modified.
const STORAGE_KEY = 'resume_builder_job_matcher'

function storageKey(uid) {
  return `${STORAGE_KEY}_${uid || 'guest'}`
}

function readStored(uid) {
  try {
    const raw = window.localStorage.getItem(storageKey(uid))
    if (!raw) return { resumeId: '', jobDescription: '' }
    const parsed = JSON.parse(raw)
    return {
      resumeId: typeof parsed?.resumeId === 'string' ? parsed.resumeId : '',
      jobDescription: typeof parsed?.jobDescription === 'string' ? parsed.jobDescription : '',
    }
  } catch {
    return { resumeId: '', jobDescription: '' }
  }
}

function writeStored(uid, value) {
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(value))
  } catch {
    /* storage unavailable — the analysis still works, it just will not persist */
  }
}

function clearStored(uid) {
  try {
    window.localStorage.removeItem(storageKey(uid))
  } catch {
    /* storage unavailable */
  }
}

function formatUpdated(ts) {
  const value = lastUpdatedAt({ updatedAt: ts, createdAt: ts })
  if (!value) return 'Unknown'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function matchTone(score) {
  if (score === null) return 'none'
  if (score >= 80) return 'strong'
  if (score >= 60) return 'good'
  if (score >= 40) return 'partial'
  return 'low'
}

function typeLabel(resume) {
  return resumeTypeOf(resume) === 'experienced' ? 'Experienced' : 'Fresher'
}

function JobMatcher() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const uid = user ? user.uid : null

  const [resumes, setResumes] = useState([])
  // Which account the current list was fetched for. `null` means "not fetched
  // yet", which is also the first-render value, so the skeleton shows straight
  // away without a setState inside the effect body.
  const [loadedFor, setLoadedFor] = useState(null)
  const [listError, setListError] = useState(null)

  const listLoading = loadedFor !== uid

  const [selectedId, setSelectedId] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const [result, setResult] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiPending, setAiPending] = useState(false)

  const analyzing = useRef(false)

  // ---------------------------------------------------------------------------
  // Resume list — the same ownership-scoped query the Vault uses, so the matcher
  // cannot show a resume belonging to anyone else.
  //
  // `loadedFor` records which account the list on screen belongs to, and
  // `listLoading` is derived from it rather than stored. That keeps the loading
  // state correct for the very first render and for an account switch without a
  // setState in the synchronous body of this effect, which the
  // react-hooks/set-state-in-effect rule rejects.
  //
  // There is deliberately no "already fetched" ref guard here. Under StrictMode
  // React runs this effect twice (run, cleanup, run); a ref guard made the second
  // run bail out while the first run's `active` flag was already false, so
  // setLoadedFor never fired and the page sat on the skeleton forever. Reading
  // twice in development is a harmless duplicate of one small query.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let active = true

    getUserResumesFromFirestore(uid)
      .then((docs) => {
        if (!active) return
        setResumes(docs)
        setListError(null)
        const stored = readStored(uid)
        if (stored.jobDescription) setJobDescription(stored.jobDescription)
        if (stored.resumeId && docs.some((r) => r.id === stored.resumeId)) {
          setSelectedId(stored.resumeId)
        }
      })
      .catch(() => {
        if (active) setListError('Unable to load your resumes. Please check your connection and try again.')
      })
      .finally(() => {
        if (active) setLoadedFor(uid)
      })

    return () => { active = false }
  }, [uid])

  // Persist the two fields, debounced so a paste does not write per keystroke.
  useEffect(() => {
    if (listLoading) return undefined
    const handle = window.setTimeout(() => {
      writeStored(uid, { resumeId: selectedId, jobDescription })
    }, 600)
    return () => window.clearTimeout(handle)
  }, [selectedId, jobDescription, uid, listLoading])

  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === selectedId) || null,
    [resumes, selectedId],
  )

  const resumeType = selectedResume ? resumeTypeOf(selectedResume) : null

  // Shown beside the Job Match Score so the two numbers can never be confused.
  const atsScore = useMemo(
    () => (selectedResume?.formData ? calculateAtsScore(selectedResume.formData, resumeType).total : null),
    [selectedResume, resumeType],
  )

  const jobDescriptionLength = jobDescription.trim().length

  const clearJobDescription = useCallback(() => {
    setJobDescription('')
  }, [])

  const resetAnalysis = useCallback(() => {
    setResult(null)
    setAnalysisError(null)
    setAiAnalysis(null)
    setAiError(null)
  }, [])

  // "Analyze Another Job" clears only the analysis, never the resume.
  const handleAnalyzeAnother = useCallback(() => {
    resetAnalysis()
    setJobDescription('')
    clearStored(uid)
    writeStored(uid, { resumeId: selectedId, jobDescription: '' })
  }, [resetAnalysis, uid, selectedId])

  const handleSelectResume = useCallback((id) => {
    setSelectedId(id)
    // A different resume invalidates every derived number on screen.
    resetAnalysis()
  }, [resetAnalysis])

  // ---------------------------------------------------------------------------
  // Deterministic analysis. Runs entirely in the browser from the selected
  // resume and the pasted text; no network, no AI involved.
  // ---------------------------------------------------------------------------
  const runAnalysis = useCallback(() => {
    setAnalysisError(null)
    setAiAnalysis(null)
    setAiError(null)

    if (!selectedResume) {
      setResult(null)
      setAnalysisError('Please select one of your resumes before analyzing.')
      return
    }
    if (!selectedResume.formData || typeof selectedResume.formData !== 'object') {
      setResult(null)
      setAnalysisError('This resume has no readable content. Open it in Enhance Resume to repair it first.')
      return
    }

    const validation = validateJobDescription(jobDescription)
    if (!validation.ok) {
      setResult(null)
      setAnalysisError(validation.error)
      return
    }

    const analysis = analyzeJobMatch(selectedResume.formData, resumeType, jobDescription)
    if (!analysis.hasJobData) {
      setResult(null)
      setAnalysisError(
        'No recognisable skills or keywords were found in this job description. Paste the full posting, including the requirements section.',
      )
      return
    }

    setResult(analysis)
  }, [selectedResume, jobDescription, resumeType])

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault()
      // The analyzing ref closes the gap between a click and React's next
      // render, so a double-click cannot start two analyses.
      if (analyzing.current) return
      analyzing.current = true
      try {
        runAnalysis()
      } finally {
        analyzing.current = false
      }
    },
    [runAnalysis],
  )

  // ---------------------------------------------------------------------------
  // AI skill gap analysis — optional layer on top of the deterministic result.
  // ---------------------------------------------------------------------------
  const handleAiAnalysis = useCallback(async () => {
    if (aiPending || !result || !result.hasJobData) return
    setAiPending(true)
    setAiError(null)
    setAiAnalysis(null)
    try {
      const analysis = await analyzeSkillGapWithAI(jobDescription, result)
      setAiAnalysis(analysis)
    } catch (err) {
      // The deterministic report is already on screen, so a Gemini failure is
      // reported in its own panel and never blanks the page.
      setAiError(
        err?.message ||
          'AI analysis is temporarily unavailable. Your basic job match analysis is still available.',
      )
    } finally {
      setAiPending(false)
    }
  }, [aiPending, result, jobDescription])

  const handleImproveResume = useCallback(() => {
    if (!selectedResume) return
    // Enhance Resume owns its own resume list and takes no resume id today, so
    // the only context the architecture can carry safely is the navigation
    // itself. Deliberately not writing the editor pointer here: Enhance Resume
    // never reads it, and setting it would silently pre-select this resume the
    // next time the user opens the regular Editor.
    navigate('/enhance')
  }, [selectedResume, navigate])

  const hasNoResumes = !listLoading && !listError && resumes.length === 0
  const canAnalyze = !!selectedResume && jobDescription.trim().length > 0 && !aiPending

  return (
    <div className="jm-page">
      <div className="container jm-narrow">
        {/* Header */}
        <header className="jm-header">
          <span className="jm-eyebrow">
            <Target size={14} />
            Job Match
          </span>
          <h1 className="jm-title">Job Description Matcher</h1>
          <p className="jm-subtitle">
            Compare your resume with a job description and discover the skills and keywords you
            should improve.
          </p>
        </header>

        {/* Empty state — no resumes to compare against. */}
        {hasNoResumes && (
          <section className="jm-card jm-empty">
            <div className="jm-empty-icon">
              <Folder size={26} />
            </div>
            <h2 className="jm-empty-title">Create a resume before using Job Matcher.</h2>
            <p className="jm-empty-text">
              Job Matcher compares your own resume against a job description. Build or import a
              resume first, then come back here.
            </p>
            <div className="jm-empty-actions">
              <Link to="/resume-type" className="btn btn-primary">
                Create Resume
              </Link>
              <Link to="/enhance" className="btn btn-ghost">
                Enhance Resume
              </Link>
            </div>
          </section>
        )}

        {listError && (
          <section className="jm-card jm-error-card" role="alert">
            <CircleAlert size={18} />
            <div>
              <strong>We could not load your resumes.</strong>
              <p>{listError}</p>
            </div>
          </section>
        )}

        {!hasNoResumes && !listError && (
          <div className="jm-layout">
            {/* ---------------- Input column ---------------- */}
            <section className="jm-card jm-input-card">
              <h2 className="jm-card-title">Compare your resume with a target job</h2>

              {listLoading ? (
                <div className="jm-loading">
                  <SkeletonText width="60%" />
                  <Skeleton width="100%" height={44} />
                  <Skeleton width="100%" height={180} />
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="jm-field">
                    <label className="jm-label" htmlFor="jm-resume">
                      Select Resume
                    </label>
                    <div className="jm-select-wrap">
                      <select
                        id="jm-resume"
                        className="form-input jm-select"
                        value={selectedId}
                        onChange={(e) => handleSelectResume(e.target.value)}
                      >
                        <option value="">Select a resume...</option>
                        {resumes.map((resume) => (
                          <option key={resume.id} value={resume.id}>
                            {resumeTitle(resume)} — {typeLabel(resume)} —{' '}
                            {isPublicResume(resume) ? 'Published' : 'Draft'} — updated{' '}
                            {formatUpdated(resume.updatedAt || resume.createdAt)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedResume && (
                      <div className="jm-resume-meta">
                        <span className="jm-meta-row">
                          <FileSearch size={13} />
                          {resumeTitle(selectedResume)}
                        </span>
                        <span className="jm-meta-row">
                          <Briefcase size={13} />
                          {typeLabel(selectedResume)}
                        </span>
                        <span className="jm-meta-row">
                          <Clock size={13} />
                          Updated {formatUpdated(selectedResume.updatedAt || selectedResume.createdAt)}
                        </span>
                        <span
                          className={`jm-status ${isPublicResume(selectedResume) ? 'is-public' : 'is-draft'}`}
                        >
                          {isPublicResume(selectedResume) ? 'Published' : 'Draft'}
                        </span>
                        {atsScore !== null && (
                          <span className="jm-meta-row jm-meta-ats">
                            <TrendingUp size={13} />
                            ATS Resume Score: {atsScore}/100
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="jm-field">
                    <div className="jm-label-row">
                      <label className="jm-label" htmlFor="jm-description">
                        Job Description
                      </label>
                      <button
                        type="button"
                        className="jm-clear-btn"
                        onClick={clearJobDescription}
                        disabled={!jobDescription}
                      >
                        <X size={13} />
                        Clear
                      </button>
                    </div>
                    <textarea
                      id="jm-description"
                      className="form-textarea jm-textarea"
                      placeholder="Paste the job description here..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      rows={12}
                      maxLength={MAX_JOB_DESCRIPTION_LENGTH}
                      disabled={aiPending}
                    />
                    <div className="jm-counter-row">
                      <span
                        className={`jm-counter ${jobDescriptionLength > 0 && jobDescriptionLength < 80 ? 'is-short' : ''}`}
                      >
                        {jobDescriptionLength.toLocaleString()} / {MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters
                      </span>
                      {jobDescriptionLength > 0 && jobDescriptionLength < 80 && (
                        <span className="jm-counter-hint">
                          Paste the full posting for an accurate analysis.
                        </span>
                      )}
                    </div>
                  </div>

                  {analysisError && (
                    <div className="jm-inline-error" role="alert">
                      <AlertTriangle size={15} />
                      <span>{analysisError}</span>
                    </div>
                  )}

                  <div className="jm-actions">
                    <button type="submit" className="btn btn-primary jm-analyze-btn" disabled={!canAnalyze}>
                      {aiPending ? (
                        <>
                          <RefreshCw size={16} className="jm-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Target size={16} />
                          Analyze Job
                        </>
                      )}
                    </button>
                    {selectedId && jobDescription && (
                      <button type="button" className="btn btn-ghost" onClick={handleAnalyzeAnother} disabled={aiPending}>
                        <Trash2 size={15} />
                        Clear
                      </button>
                    )}
                  </div>
                </form>
              )}
            </section>

            {/* ---------------- Result column ---------------- */}
            {result && result.hasJobData && (
              <section className="jm-results" aria-live="polite">
                {/* Job Match Score */}
                <div className="jm-card jm-score-card">
                  <h3 className="jm-section-title">Job Match</h3>
                  <div className="jm-score-wrap">
                    <div className={`jm-score-ring jm-tone-${matchTone(result.score)}`}>
                      <span className="jm-score-value">{result.score}%</span>
                    </div>
                    <div className="jm-score-info">
                      <span className="jm-score-label">{result.label}</span>
                      <p className="jm-score-note">
                        Job Match Score measures this resume against this one job posting.
                      </p>
                      {atsScore !== null && (
                        <p className="jm-score-distinct">
                          Your ATS Resume Score is <strong>{atsScore}/100</strong> — a separate measure
                          of how well a parser reads your resume.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="jm-coverage">
                    <div className="jm-coverage-item">
                      <span className="jm-coverage-label">
                        Skills <strong>{result.coverages.skills}%</strong>
                      </span>
                      <div className="jm-coverage-bar">
                        <div className="jm-coverage-fill" style={{ width: `${result.coverages.skills}%` }} />
                      </div>
                    </div>
                    <div className="jm-coverage-item">
                      <span className="jm-coverage-label">
                        Keywords <strong>{result.coverages.keywords}%</strong>
                      </span>
                      <div className="jm-coverage-bar">
                        <div className="jm-coverage-fill" style={{ width: `${result.coverages.keywords}%` }} />
                      </div>
                    </div>
                    {result.coverages.experience !== null && (
                      <div className="jm-coverage-item">
                        <span className="jm-coverage-label">
                          Experience <strong>{result.coverages.experience}%</strong>
                        </span>
                        <div className="jm-coverage-bar">
                          <div
                            className="jm-coverage-fill"
                            style={{ width: `${result.coverages.experience}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Matching Skills */}
                <div className="jm-card">
                  <h3 className="jm-section-title">
                    <CheckCircle2 size={16} />
                    Matching Skills
                    <span className="jm-count">{result.counts.matchedSkills}</span>
                  </h3>
                  {result.matchedSkills.length ? (
                    <>
                      <div className="jm-chips">
                        {result.matchedSkills.map((skill) => (
                          <span className="jm-chip jm-chip-ok" key={skill}>
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                      {result.matchedSkillsByCategory.length > 0 && (
                        <div className="jm-groups">
                          {result.matchedSkillsByCategory.map((group) => (
                            <div className="jm-group" key={group.category}>
                              <span className="jm-group-label">{group.category}</span>
                              <div className="jm-chips">
                                {group.items.map((item) => (
                                  <span className="jm-chip jm-chip-ok jm-chip-sm" key={item}>
                                    ✓ {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="jm-empty-inline">
                      None of the skills this job asks for appear on your resume yet.
                    </p>
                  )}
                </div>

                {/* Skills to Improve */}
                <div className="jm-card">
                  <h3 className="jm-section-title">
                    <AlertTriangle size={16} />
                    Skills to Improve
                    <span className="jm-count">{result.counts.missingSkills}</span>
                  </h3>
                  {result.missingSkills.length ? (
                    <>
                      <div className="jm-chips">
                        {result.missingSkills.map((skill) => (
                          <span className="jm-chip jm-chip-warn" key={skill}>
                            ⚠ {skill}
                          </span>
                        ))}
                      </div>
                      {result.missingSkillsByCategory.length > 0 && (
                        <div className="jm-groups">
                          {result.missingSkillsByCategory.map((group) => (
                            <div className="jm-group" key={group.category}>
                              <span className="jm-group-label">{group.category}</span>
                              <div className="jm-chips">
                                {group.items.map((item) => (
                                  <span className="jm-chip jm-chip-warn jm-chip-sm" key={item}>
                                    ⚠ {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="jm-hint">
                        Only add a skill you can genuinely evidence. Mentioning a tool you have never
                        used is the fastest way to lose an interview.
                      </p>
                    </>
                  ) : (
                    <p className="jm-empty-inline">
                      Your resume already covers every skill this job description names.
                    </p>
                  )}
                </div>

                {/* Keywords */}
                <div className="jm-card">
                  <h3 className="jm-section-title">Keyword Analysis</h3>
                  <div className="jm-keyword-cols">
                    <div>
                      <span className="jm-col-label jm-col-ok">
                        Matching Keywords
                        <span className="jm-count">{result.counts.matchedKeywords}</span>
                      </span>
                      {result.matchedKeywords.length ? (
                        <div className="jm-chips">
                          {result.matchedKeywords.map((keyword) => (
                            <span className="jm-chip jm-chip-kw-ok" key={keyword}>
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="jm-empty-inline">No matching keywords yet.</p>
                      )}
                    </div>
                    <div>
                      <span className="jm-col-label jm-col-warn">
                        Missing Keywords
                        <span className="jm-count">{result.counts.missingKeywords}</span>
                      </span>
                      {result.missingKeywords.length ? (
                        <div className="jm-chips">
                          {result.missingKeywords.map((keyword) => (
                            <span className="jm-chip jm-chip-kw-warn" key={keyword}>
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="jm-empty-inline">No important keywords are missing.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Experience Match */}
                {result.experience.length > 0 && (
                  <div className="jm-card">
                    <h3 className="jm-section-title">Experience Match</h3>
                    <ul className="jm-exp-list">
                      {result.experience.map((area) => (
                        <li
                          className={`jm-exp-item ${area.covered ? 'is-ok' : 'is-warn'}`}
                          key={area.label}
                        >
                          <span className="jm-exp-mark">{area.covered ? '✓' : '⚠'}</span>
                          <div className="jm-exp-body">
                            <span className="jm-exp-label">{area.label}</span>
                            {area.covered ? (
                              <>
                                {area.evidence.length > 0 && (
                                  <span className="jm-exp-detail">Shown in: {area.evidence.join(', ')}</span>
                                )}
                                {area.skills.length > 0 && (
                                  <span className="jm-exp-detail">
                                    Skills evidenced: {area.skills.join(', ')}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="jm-exp-detail">
                                No experience on your resume demonstrates this yet.
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI Skill Gap Analysis */}
                <div className="jm-card jm-ai-card">
                  <h3 className="jm-section-title">
                    <Sparkles size={16} />
                    AI Skill Gap Analysis
                  </h3>

                  {aiPending && (
                    <div className="jm-ai-loading" aria-live="polite">
                      <RefreshCw size={16} className="jm-spin" />
                      <span>Analyzing your resume against this job description...</span>
                    </div>
                  )}

                  {!aiPending && !aiAnalysis && !aiError && (
                    <>
                      <p className="jm-ai-intro">
                        Ask Gemini to review the gaps above and suggest what to prioritise.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary jm-ai-btn"
                        onClick={handleAiAnalysis}
                        disabled={!result.hasJobData}
                      >
                        <Wand2 size={16} />
                        Run AI Skill Gap Analysis
                      </button>
                    </>
                  )}

                  {!aiPending && aiError && (
                    <div className="jm-ai-error" role="alert">
                      <CircleAlert size={16} />
                      <div>
                        <strong>AI analysis is temporarily unavailable.</strong>
                        <p>
                          {aiError} Your basic job match analysis above is still available and accurate.
                        </p>
                        <button
                          type="button"
                          className="btn btn-ghost jm-ai-retry"
                          onClick={handleAiAnalysis}
                        >
                          <RefreshCw size={14} />
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}

                  {!aiPending && aiAnalysis && (
                    <div className="jm-ai-results">
                      {aiAnalysis.summary && <p className="jm-ai-summary">{aiAnalysis.summary}</p>}

                      {aiAnalysis.prioritySkills.length > 0 && (
                        <div className="jm-ai-block">
                          <span className="jm-col-label">Priority Skills</span>
                          <div className="jm-chips">
                            {aiAnalysis.prioritySkills.map((item) => (
                              <span className="jm-chip jm-chip-priority" key={item}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {aiAnalysis.missingKeywords.length > 0 && (
                        <div className="jm-ai-block">
                          <span className="jm-col-label">Keywords to Work In</span>
                          <div className="jm-chips">
                            {aiAnalysis.missingKeywords.map((item) => (
                              <span className="jm-chip jm-chip-kw-warn" key={item}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {aiAnalysis.experienceGaps.length > 0 && (
                        <div className="jm-ai-block">
                          <span className="jm-col-label">Experience Gaps</span>
                          <ul className="jm-ai-list">
                            {aiAnalysis.experienceGaps.map((item, i) => (
                              <li key={`${item}-${i}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiAnalysis.suggestions.length > 0 && (
                        <div className="jm-ai-block">
                          <span className="jm-col-label">AI Recommendations</span>
                          <div className="jm-suggestions">
                            {aiAnalysis.suggestions.map((item, i) => (
                              <div className="jm-suggestion" key={`${item}-${i}`}>
                                <span className="jm-suggestion-bullet" />
                                <p>{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="jm-ai-disclaimer">
                        AI suggestions are a starting point. Review every one and only keep what is
                        true for you.
                      </p>

                      <div className="jm-result-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleImproveResume}
                        >
                          <Wand2 size={15} />
                          Improve My Resume
                          <ArrowRight size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={handleAiAnalysis}
                        >
                          <RefreshCw size={14} />
                          Re-run AI Analysis
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={handleAnalyzeAnother}>
                          <Trash2 size={14} />
                          Analyze Another Job
                        </button>
                      </div>
                    </div>
                  )}

                  {!aiPending && !aiAnalysis && !aiError && (
                    <div className="jm-result-actions">
                      <button type="button" className="btn btn-primary" onClick={handleImproveResume}>
                        <Wand2 size={15} />
                        Improve My Resume
                        <ArrowRight size={15} />
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={handleAnalyzeAnother}>
                        <Trash2 size={14} />
                        Analyze Another Job
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default JobMatcher