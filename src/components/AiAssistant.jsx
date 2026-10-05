import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, RefreshCw, Sparkles, X } from 'lucide-react'
import { enhanceWithAI } from '../services/aiEnhancement'
import './AiAssistant.css'

function AiAssistant({ text, type = 'objective', onApply, label = 'Improve with AI', minLength = 10 }) {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [suggestion, setSuggestion] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const location = useLocation()

  const source = (typeof text === 'string' ? text : '').trim()
  const needsSignIn = errorCode === 'auth-required'

  const close = () => {
    setStatus('idle')
    setSuggestion('')
    setErrorMsg('')
    setErrorCode('')
  }

  const handleGenerate = async () => {
    if (!source) return
    setStatus('loading')
    setSuggestion('')
    setErrorMsg('')
    setErrorCode('')
    try {
      const result = await enhanceWithAI(source, type)
      if (!result || !result.trim()) {
        setStatus('error')
        setErrorMsg('AI returned no result. Please try again.')
        return
      }
      setSuggestion(result.trim())
      setStatus('ready')
    } catch (err) {
      // Show what actually went wrong. Swallowing this behind a generic
      // "unavailable" message made a wrong GEMINI_MODEL look like an outage.
      // Only the message is logged, never the request or any token.
      const detail = err instanceof Error && err.message ? err.message : 'Unexpected error.'
      console.warn('[AiAssistant] AI enhancement failed:', detail)
      setStatus('error')
      setErrorMsg(detail)
      setErrorCode(err instanceof Error && err.code ? err.code : '')
    }
  }

  const handleApply = () => {
    if (onApply && suggestion) {
      onApply(suggestion)
    }
    close()
  }

  const disabled = source.length < minLength

  return (
    <div className="ai-assistant">
      {status === 'idle' && (
        <button
          className="ai-trigger"
          type="button"
          onClick={handleGenerate}
          disabled={disabled}
          title={disabled ? `Add at least ${minLength} characters to improve this section` : `Generate an improved version of this section`}
        >
          <Sparkles size={14} />
          {label}
        </button>
      )}

      {status === 'loading' && (
        <div className="ai-box" role="status">
          <div className="ai-box-head">
            <span className="ai-spinner" aria-hidden="true"></span>
            <span className="ai-box-title">Improving with AI...</span>
          </div>
          <p className="ai-box-hint">Your original text is safe. Review the suggestion before applying.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="ai-box ai-error">
          <div className="ai-box-head">
            <X size={16} className="ai-error-icon" />
            <span className="ai-box-title">{needsSignIn ? 'Sign in to use AI' : 'AI unavailable'}</span>
            <button className="ai-icon-btn" type="button" onClick={close} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
          <p className="ai-box-hint">{errorMsg} You can continue editing normally.</p>
          {needsSignIn ? (
            <Link className="ai-btn ai-btn-primary" to="/login" state={{ from: location }}>
              Sign in
            </Link>
          ) : (
            <button className="ai-btn ai-btn-outline" type="button" onClick={handleGenerate}>
              <RefreshCw size={14} />
              Try again
            </button>
          )}
        </div>
      )}

      {status === 'ready' && (
        <div className="ai-box">
          <div className="ai-box-head">
            <Sparkles size={16} className="ai-ready-icon" />
            <span className="ai-box-title">AI suggestion</span>
            <button className="ai-icon-btn" type="button" onClick={close} aria-label="Cancel">
              <X size={14} />
            </button>
          </div>
          <p className="ai-suggestion">{suggestion}</p>
          <div className="ai-actions">
            <button className="ai-btn ai-btn-primary" type="button" onClick={handleApply}>
              <Check size={14} />
              Apply
            </button>
            <button className="ai-btn ai-btn-outline" type="button" onClick={close}>
              Cancel
            </button>
            <button className="ai-btn ai-btn-ghost" type="button" onClick={handleGenerate}>
              <RefreshCw size={14} />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AiAssistant
