import { useRef, useState } from 'react'
import { Globe, Plus, X } from 'lucide-react'
import './Languages.css'

const LANGUAGE_OPTIONS = [
  'English',
  'Tamil',
  'Hindi',
  'Malayalam',
  'Telugu',
  'Kannada',
  'Bengali',
  'Marathi',
  'French',
  'German',
  'Spanish',
  'Other',
]

const PROFICIENCY_LEVELS = ['Basic', 'Intermediate', 'Advanced', 'Fluent', 'Native']

function normalizeEntry(lang) {
  if (typeof lang === 'string') return { name: lang, proficiency: '' }
  return {
    name: lang && lang.name ? lang.name : '',
    proficiency: lang && lang.proficiency ? lang.proficiency : '',
  }
}

function Languages({ languages, onChange }) {
  const [name, setName] = useState('')
  const [proficiency, setProficiency] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)

  const list = (languages || []).map(normalizeEntry)
  const query = name.trim().toLowerCase()
  const suggestions = LANGUAGE_OPTIONS.filter((opt) => opt.toLowerCase().includes(query))

  const pickSuggestion = (opt) => {
    if (opt === 'Other') {
      setName('')
      if (inputRef.current) inputRef.current.focus()
    } else {
      setName(opt)
    }
    setActiveIndex(-1)
    setOpen(true)
  }

  const addLanguage = (value) => {
    const trimmed = (value == null ? name : value).trim()
    if (!trimmed) return
    const exists = list.some((lang) => lang.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (!exists) {
      onChange([...list, { name: trimmed, proficiency }])
    }
    setName('')
    setProficiency('')
    setActiveIndex(-1)
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        pickSuggestion(suggestions[activeIndex])
      } else {
        addLanguage()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const removeLanguage = (index) => {
    onChange(list.filter((_, i) => i !== index))
  }

  const updateProficiency = (index, value) => {
    onChange(list.map((lang, i) => (i === index ? { ...lang, proficiency: value } : lang)))
  }

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <Globe size={20} />
        Languages
      </h3>

      <div className="language-input-row">
        <div className="language-autocomplete">
          <input
            ref={inputRef}
            type="text"
            className="form-input language-input"
            placeholder="Select or type a language"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
          />
          {open && suggestions.length > 0 && (
            <ul className="language-suggestions">
              {suggestions.map((opt, i) => (
                <li
                  key={opt}
                  className={`language-suggestion ${i === activeIndex ? 'language-suggestion-active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickSuggestion(opt)
                  }}
                >
                  {opt}
                </li>
              ))}
            </ul>
          )}
        </div>

        <select
          className="form-input language-proficiency-select"
          value={proficiency}
          onChange={(e) => setProficiency(e.target.value)}
          aria-label="Proficiency (optional)"
        >
          <option value="">Proficiency (optional)</option>
          {PROFICIENCY_LEVELS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <button className="add-btn language-add-btn" type="button" onClick={() => addLanguage()}>
          <Plus size={16} strokeWidth={2.5} />
          Add Language
        </button>
      </div>

      {list.length > 0 && (
        <div className="language-list">
          {list.map((lang, i) => (
            <div className="language-item" key={i}>
              <span className="language-name">{lang.name}</span>
              <select
                className="language-item-proficiency"
                value={lang.proficiency}
                onChange={(e) => updateProficiency(i, e.target.value)}
                aria-label={`${lang.name} proficiency`}
              >
                <option value="">Proficiency</option>
                {PROFICIENCY_LEVELS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                className="language-remove"
                type="button"
                onClick={() => removeLanguage(i)}
                aria-label={`Remove ${lang.name}`}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Languages
