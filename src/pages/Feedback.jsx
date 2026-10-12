import { useState } from 'react'
import { AlertCircle, CheckCircle, MessageSquare, Send } from 'lucide-react'
import { addDoc, collection } from 'firebase/firestore'
import { getDb, firebaseConfigured } from '../firebase'
import { useAuth } from '../context/AuthContext'
import {
  FEEDBACK_COLLECTION,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_NAME_MAX_LENGTH,
  FEEDBACK_PATH,
  FEEDBACK_PATH_MAX_LENGTH,
} from '../config/feedback'
import './Feedback.css'

// Firestore reports every failure with a code, so the visitor gets a specific
// message instead of a generic apology. An unexpected code still gets a
// sentence that tells them what to do next.
function mapSubmitError(error) {
  switch (error && error.code) {
    case 'permission-denied':
      return 'Feedback could not be saved just now. Please try again in a moment.'
    case 'unavailable':
      return 'No connection to the server. Check your internet and try again.'
    case 'unauthenticated':
      return 'Your session has expired. Please sign in again, or send this as a guest.'
    case 'deadline-exceeded':
      return 'That took too long to save. Please try again.'
    default:
      return 'Something went wrong while sending your feedback. Please try again.'
  }
}

function Feedback() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState('')
  // `busy` both disables the button and guards the handler, so a double click
  // or an Enter key held down cannot fire a second write while the first is
  // still in flight and store the same message twice.
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const trimmedFeedback = feedback.trim()
  const trimmedName = name.trim()
  const isEmpty = trimmedFeedback.length === 0
  const isTooLong = trimmedFeedback.length > FEEDBACK_MAX_LENGTH
  const canSubmit = !busy && !isEmpty && !isTooLong

  const handleSubmit = async (event) => {
    event.preventDefault()
    // The disabled button is the primary guard; this is the belt to that
    // braces, because the state update is not applied until the next render.
    if (busy) return

    if (!firebaseConfigured) {
      setNotice({
        type: 'error',
        text: 'Feedback is unavailable right now because this build is not connected to Firebase. Please try again later.',
      })
      return
    }
    if (isEmpty) {
      setNotice({ type: 'error', text: 'Please write your feedback before sending it.' })
      return
    }
    if (isTooLong) {
      setNotice({
        type: 'error',
        text: `Please keep your feedback under ${FEEDBACK_MAX_LENGTH.toLocaleString()} characters.`,
      })
      return
    }

    setBusy(true)
    setNotice(null)

    try {
      await addDoc(collection(getDb(), FEEDBACK_COLLECTION), {
        message: trimmedFeedback,
        // The name is optional, so it is stored as an empty string rather than
        // omitted: firestore.rules requires `name` to be present.
        name: trimmedName.slice(0, FEEDBACK_NAME_MAX_LENGTH),
        path: FEEDBACK_PATH.slice(0, FEEDBACK_PATH_MAX_LENGTH),
        createdAt: Date.now(),
        // Only the caller's own uid, and only when someone is signed in. A uid
        // is a random identifier, not an email address or profile, and the
        // rules reject a document whose userId is anybody else's. An anonymous
        // submission simply leaves the field out.
        ...(user ? { userId: user.uid } : {}),
      })
      setFeedback('')
      setNotice({
        type: 'success',
        text: 'Thanks for the feedback. It has been saved and every message is read.',
      })
    } catch (error) {
      setNotice({ type: 'error', text: mapSubmitError(error) })
    } finally {
      setBusy(false)
    }
  }

  const handleFeedbackChange = (event) => {
    setFeedback(event.target.value)
    // Clear a stale error as soon as the visitor starts fixing it, so the old
    // message does not sit above the text they are correcting.
    setNotice((current) => (current && current.type === 'error' ? null : current))
  }

  const remaining = FEEDBACK_MAX_LENGTH - feedback.length

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

          <form className="feedback-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
            <div className="feedback-field">
              <label className="feedback-label" htmlFor="feedback-name">
                Name <span className="feedback-optional">(optional)</span>
              </label>
              <input
                id="feedback-name"
                className="feedback-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                maxLength={FEEDBACK_NAME_MAX_LENGTH}
                disabled={busy}
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
                onChange={handleFeedbackChange}
                placeholder="Tell us what you think..."
                rows={6}
                required
                aria-invalid={isTooLong}
                aria-describedby="feedback-count"
                disabled={busy}
              />
              <p
                className={`feedback-count ${isTooLong ? 'feedback-count-over' : ''}`}
                id="feedback-count"
              >
                {isTooLong
                  ? `${Math.abs(remaining).toLocaleString()} characters over the limit.`
                  : `${remaining.toLocaleString()} characters left.`}
              </p>
            </div>

            <button type="submit" className="btn btn-primary feedback-submit" disabled={!canSubmit}>
              {busy ? (
                <>
                  <Send size={18} aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={18} aria-hidden="true" />
                  Submit Feedback
                </>
              )}
            </button>

            {notice && (
              <p
                className={`feedback-notice ${notice.type === 'error' ? 'feedback-notice-error' : ''}`}
                role={notice.type === 'error' ? 'alert' : 'status'}
              >
                {notice.type === 'error' ? (
                  <AlertCircle size={16} className="feedback-notice-icon" aria-hidden="true" />
                ) : (
                  <CheckCircle size={16} className="feedback-notice-icon" aria-hidden="true" />
                )}
                <span>{notice.text}</span>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default Feedback