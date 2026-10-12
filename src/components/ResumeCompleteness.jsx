import { useMemo } from 'react'
import { CheckCircle2, AlertTriangle, Gauge } from 'lucide-react'
import { calculateResumeCompleteness } from '../utils/resumeCompleteness'
import './ResumeCompleteness.css'

export default function ResumeCompleteness({ data, resumeType }) {
  const result = useMemo(() => calculateResumeCompleteness(data, resumeType), [data, resumeType])

  const message =
    result.score === 100
      ? 'Your resume is complete!'
      : result.incomplete === 1
        ? 'Complete 1 more section to improve your resume.'
        : `Complete ${result.incomplete} more sections to improve your resume.`

  return (
    <div className="rc-card">
      <div className="rc-card-header">
        <h3 className="rc-card-title">
          <Gauge size={18} />
          Resume Completeness
        </h3>
      </div>

      <div className="rc-summary">
        <div className="rc-score">
          <span className="rc-score-value">{result.score}</span>
          <span className="rc-score-unit">%</span>
        </div>
        <div className="rc-score-info">
          <div
            className="rc-bar"
            role="progressbar"
            aria-valuenow={result.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Resume completeness"
          >
            <div className="rc-bar-fill" style={{ width: `${result.score}%` }}></div>
          </div>
          <span className="rc-score-caption">Your resume is {result.score}% complete.</span>
          <span className="rc-count-caption">{result.completed} of {result.total} sections complete</span>
        </div>
      </div>

      <p className="rc-msg">{message}</p>

      <ul className="rc-list">
        {result.sections.map((s) => (
          <li key={s.key} className={`rc-item ${s.complete ? 'ok' : 'miss'}`}>
            {s.complete ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span className="rc-name">{s.label}</span>
            <span className="rc-status">{s.complete ? 'Complete' : 'Incomplete'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}