import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { FEEDBACK_EMAIL, FEEDBACK_SUBJECT } from '../config/feedback'
import './Feedback.css'

function Feedback() {
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState('')
  const [notice, setNotice] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    const body = `Name:\n${name.trim() || 'Not provided'}\n\nFeedback:\n${feedback.trim()}`
    const href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      FEEDBACK_SUBJECT
    )}&body=${encodeURIComponent(body)}`

    window.location.href = href
    setNotice('Your email app has been opened. Please send the feedback.')
  }

  return (
    <div className="feedback-page">
      <div className="feedback-container">
        <div className="feedback-card">
          <div className="feedback-icon">
            <MessageSquare size={26} />
          </div>

          <h1 className="feedback-title">Share Your Feedback</h1>
          <p className="feedback-subtitle">
            Help us improve ResumeBuilder. Tell us what you like or what we can improve.
          </p>

          <form className="feedback-form" onSubmit={handleSubmit} noValidate>
            <div className="feedback-field">
              <label className="feedback-label" htmlFor="feedback-name">
                Name
              </label>
              <input
                id="feedback-name"
                className="feedback-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
              />
            </div>

            <div className="feedback-field">
              <label className="feedback-label" htmlFor="feedback-message">
                Feedback
              </label>
              <textarea
                id="feedback-message"
                className="feedback-textarea"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us what you think..."
                rows={6}
              />
            </div>

            <button type="submit" className="btn btn-primary feedback-submit">
              <Send size={18} />
              Submit Feedback
            </button>

            {notice && (
              <p className="feedback-notice" role="status">
                {notice}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default Feedback
