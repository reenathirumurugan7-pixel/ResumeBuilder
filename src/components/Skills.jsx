import { useRef, useState } from 'react'
import { Code2, Plus, X } from 'lucide-react'
import AiAssistant from './AiAssistant'
import './Skills.css'

const SKILL_OPTIONS = [
  'Python',
  'Java',
  'JavaScript',
  'React.js',
  'HTML',
  'CSS',
  'SQL',
  'MongoDB',
  'MySQL',
  'Power BI',
  'Excel',
  'Machine Learning',
  'Artificial Intelligence',
  'Data Analysis',
  'Data Science',
  'Git',
  'GitHub',
  'Firebase',
  'Node.js',
  'C',
  'C++',
  'Prompt Engineering',
  'Canva',
  'Microsoft Word',
  'Microsoft PowerPoint',
]

function Skills({ skills, onChange }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)

  const list = skills || []
  const query = input.trim().toLowerCase()
  const suggestions = SKILL_OPTIONS.filter((option) => option.toLowerCase().includes(query))

  const addSkill = (value) => {
    const trimmed = (value == null ? input : value).trim()
    if (!trimmed) return
    if (!list.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...list, trimmed])
    }
    setInput('')
    setActiveIndex(-1)
  }

  const removeSkill = (skillToRemove) => {
    onChange(list.filter((skill) => skill !== skillToRemove))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        addSkill(suggestions[activeIndex])
      } else {
        addSkill()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActiveIndex((prev) => (suggestions.length ? (prev + 1) % suggestions.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (suggestions.length ? (prev <= 0 ? suggestions.length - 1 : prev - 1) : -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <Code2 size={20} />
        Skills
      </h3>

      <div className="skill-input-row">
        <div className="skill-autocomplete">
          <input
            ref={inputRef}
            type="text"
            className="form-input skill-input"
            placeholder="Search or type a skill and press Enter"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
          />
          {open && (
            <ul className="skill-suggestions">
              {suggestions.length > 0 ? (
                suggestions.map((option, i) => (
                  <li
                    key={option}
                    className={`skill-suggestion ${i === activeIndex ? 'skill-suggestion-active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      addSkill(option)
                    }}
                  >
                    {option}
                  </li>
                ))
              ) : (
                <li className="skill-suggestion skill-suggestion-hint">
                  No match — type your own skill and press Enter
                </li>
              )}
            </ul>
          )}
        </div>
        <button className="add-btn skill-add-btn" type="button" onClick={() => addSkill()}>
          <Plus size={16} strokeWidth={2.5} />
          Add
        </button>
      </div>

      {list.length > 0 && (
        <div className="skill-tags">
          {list.map((skill) => (
            <span className="skill-tag" key={skill}>
              {skill}
              <button
                className="skill-tag-remove"
                type="button"
                onClick={() => removeSkill(skill)}
                aria-label={`Remove ${skill}`}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      {list.length > 0 && (
        <div className="skill-ai-row">
          <AiAssistant
            text={list.join(', ')}
            type="skills"
            label="Improve skills with AI"
            onApply={(result) => {
              const cleaned = result
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
              onChange(cleaned)
            }}
          />
        </div>
      )}

    </div>
  )
}

export default Skills
