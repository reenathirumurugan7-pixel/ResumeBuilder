import { useRef, useState } from 'react'
import './Typeahead.css'
import { capitalizeInputValue, capitalizeWords } from '../utils/capitalize'

function Typeahead({
  options = [],
  value,
  onChange,
  placeholder,
  minQueryLength = 0,
  maxResults = 12,
  typeLabel = null,
  capitalize = false,
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)

  const applyCapitalization = (nextValue) => (capitalize ? capitalizeWords(nextValue) : nextValue)

  const query = value.trim().toLowerCase()
  const allMatches = options.filter((opt) => opt.toLowerCase().includes(query))

  const showTypeOption = Boolean(typeLabel) && query.length >= minQueryLength

  const suggestions = allMatches.slice(0, maxResults)
  const hasMore = allMatches.length > maxResults
  const showDropdown = open && query.length >= minQueryLength && (query.length > 0 || minQueryLength === 0)

  const selectOption = (opt) => {
    if (opt === 'Other') {
      onChange('')
      if (inputRef.current) inputRef.current.focus()
    } else {
      onChange(applyCapitalization(opt))
    }
    setActiveIndex(-1)
  }

  const requestCustom = () => {
    onChange('')
    if (inputRef.current) inputRef.current.focus()
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIndex === 0 && showTypeOption) {
        requestCustom()
        return
      }
      if (open && activeIndex > 0 && suggestions[activeIndex - 1]) {
        selectOption(suggestions[activeIndex - 1])
      }
      setOpen(false)
      setActiveIndex(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const total = suggestions.length + (showTypeOption ? 1 : 0)
      setActiveIndex((prev) => (total ? (prev + 1) % total : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const total = suggestions.length + (showTypeOption ? 1 : 0)
      setActiveIndex((prev) => (total ? (prev <= 0 ? total - 1 : prev - 1) : -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const renderSuggestion = (opt, i) => {
    const listIndex = i + (showTypeOption ? 1 : 0)
    return (
      <li
        key={opt}
        className={`typeahead-suggestion ${listIndex === activeIndex ? 'typeahead-suggestion-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          selectOption(opt)
        }}
      >
        {opt}
      </li>
    )
  }

  return (
    <div className="typeahead">
      <input
        ref={inputRef}
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(capitalize ? capitalizeInputValue(e) : e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (
        <ul className="typeahead-suggestions">
          {showTypeOption && (
            <li
              key="__type__"
              className={`typeahead-suggestion typeahead-suggestion-custom ${activeIndex === 0 ? 'typeahead-suggestion-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                requestCustom()
              }}
            >
              {typeLabel}
            </li>
          )}
          {suggestions.map((opt, i) => renderSuggestion(opt, i))}
          {hasMore && (
            <li className="typeahead-suggestion typeahead-suggestion-hint">
              {allMatches.length - maxResults} more matches — keep typing to narrow down
            </li>
          )}
          {suggestions.length === 0 && !showTypeOption && (
            <li className="typeahead-suggestion typeahead-suggestion-hint">
              No match — type your own value and press Enter
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default Typeahead