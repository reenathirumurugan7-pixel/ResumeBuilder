import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { calculateAtsScore, matchJobDescription } from '../services/atsScore'
import './AtsScorePanel.css'

const LEVEL_COLORS = {
  Excellent: '#16A34A',
  'Very Good': '#16A34A',
  Good: '#2563EB',
  'Needs Improvement': '#D97706',
  Poor: '#DC2626',
}

function getLevelColor(level) {
  return LEVEL_COLORS[level] || '#DC2626'
}

function ScoreCircle({ score }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference
  return (
    <div className="ats-circle-wrap">
      <svg className="ats-circle" width="110" height="110" viewBox="0 0 110 110">
        <circle className="ats-circle-bg" cx="55" cy="55" r={radius} />
        <circle
          className="ats-circle-progress"
          cx="55"
          cy="55"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="ats-circle-label">
        <span className="ats-circle-score">{score}</span>
        <span className="ats-circle-total">/ 100</span>
      </div>
    </div>
  )
}

function AtsScoreCard({ data, resumeType }) {
  const [jobDescription, setJobDescription] = useState('')

  const result = useMemo(() => calculateAtsScore(data, resumeType, jobDescription), [data, resumeType, jobDescription])
  const jobMatch = useMemo(
    () => matchJobDescription(data, resumeType, jobDescription),
    [data, resumeType, jobDescription]
  )

  const levelColor = getLevelColor(result.level)

  return (
    <div className="ats-card">
      <div className="ats-card-header">
        <h3 className="ats-card-title">
          <Clock size={18} />
          ATS Resume Score
        </h3>
        <span className="ats-card-level" style={{ color: levelColor }}>{result.level}</span>
      </div>

      <div className="ats-score-summary">
        <ScoreCircle score={result.total} />
        <div className="ats-score-info">
          <div className="ats-score-bar">
            <div className="ats-score-bar-fill" style={{ width: `${result.total}%`, background: levelColor }}></div>
          </div>
          <span className="ats-score-bar-label">{result.total} / 100</span>
          <p className="ats-score-desc">
            Estimates how well Applicant Tracking Systems can read and rank your resume.
          </p>
        </div>
      </div>

      {result.sections.length > 0 && (
        <div className="ats-sections">
          <h4 className="ats-improve-title">Section Analysis</h4>
          <p className="ats-section-caption">
            {result.sections.filter((s) => s.present).length} of {result.sections.length} sections completed
          </p>
          <ul className="ats-section-list">
            {result.sections.map((s) => (
              <li key={s.label} className={`ats-section-item ${s.present ? 'ok' : 'miss'}`}>
                <span className="ats-section-mark">{s.present ? '✓' : '✗'}</span>
                <span className="ats-section-name">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ats-categories">
        {result.categories.map((cat) => {
          const pct = cat.max > 0 ? (cat.score / cat.max) * 100 : 0
          return (
            <div className="ats-category" key={cat.label}>
              <div className="ats-category-head">
                <span className="ats-category-label">{cat.label}</span>
                <span className="ats-category-value">{cat.score}/{cat.max}</span>
              </div>
              <div className="ats-category-bar">
                <div className="ats-category-bar-fill" style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="ats-improve">
        <h4 className="ats-improve-title">Suggestions</h4>
        {result.suggestions.length === 0 ? (
          <p className="ats-empty">Great job! Your resume is well-completed across all sections.</p>
        ) : (
          <ul className="ats-suggestions">
            {result.suggestions.slice(0, 6).map((s, i) => (
              <li className="ats-suggestion" key={i}>
                <span className="ats-suggestion-bullet"></span>
                <span>{s.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ats-jd">
        <label className="ats-jd-label" htmlFor="ats-jd">Paste a job description to check keyword match</label>
        {!jobDescription.trim() && (
          <p className="ats-hint">Add a job description to unlock the job-match component of your ATS score.</p>
        )}
        <textarea
          id="ats-jd"
          className="form-textarea ats-jd-input"
          placeholder="Paste the job description here..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={3}
        />
        {jobDescription.trim() && (
          <div className="ats-jd-results">
            <div className="ats-match-row">
              <span className="ats-match-label">Keyword Match</span>
              <span className="ats-match-percent">{jobMatch.matchPercent}%</span>
            </div>
            <div className="ats-score-bar">
              <div className="ats-score-bar-fill" style={{ width: `${jobMatch.matchPercent}%`, background: getLevelColor(jobMatch.matchPercent >= 80 ? 'Excellent' : jobMatch.matchPercent >= 60 ? 'Good' : 'Needs Improvement') }}></div>
            </div>
            <p className="ats-hint">
              Add missing keywords naturally where they are truthful and relevant. Never invent skills or experience.
            </p>
            {jobMatch.matched.length > 0 && (
              <div className="ats-match-col">
                <span className="ats-match-col-title">Matched</span>
                <div className="ats-tags">
                  {jobMatch.matched.map((kw) => <span className="ats-tag ats-tag-matched" key={kw}>✓ {kw}</span>)}
                </div>
              </div>
            )}
            {jobMatch.missing.length > 0 && (
              <div className="ats-match-col">
                <span className="ats-match-col-title">Missing</span>
                <div className="ats-tags">
                  {jobMatch.missing.map((kw) => <span className="ats-tag ats-tag-missing" key={kw}>⚠ {kw}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AtsScoreCard
