import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { filterDepartments } from '../data/departments'
import './DepartmentSelect.css'
import { capitalizeInputValue, capitalizeWords } from '../utils/capitalize'

function DepartmentSelect({
  id,
  value = '',
  onChange,
  placeholder = 'Type or select department...',
  capitalize = false,
}) {
  const generatedId = useId()
  const inputId = id || `department-${generatedId}`
  const listboxId = `${inputId}-listbox`

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const blurTimer = useRef(null)

  const groups = useMemo(() => filterDepartments(value), [value])

  const { rows, selectableItems } = useMemo(() => {
    const selectable = []
    const displayRows = []

    groups.forEach((group) => {
      displayRows.push({ type: 'header', key: group.id, label: group.label })
      group.courses.forEach((course) => {
        const index = selectable.length
        const item = { type: 'course', label: course }
        selectable.push(item)
        displayRows.push({ type: 'option', item, index })
      })
    })

    const customIndex = selectable.length
    const customItem = { type: 'custom', label: 'Other / Enter custom major' }
    selectable.push(customItem)
    displayRows.push({ type: 'option', item: customItem, index: customIndex })

    if (value) {
      const index = selectable.length
      const item = { type: 'clear', label: 'Clear selection' }
      selectable.push(item)
      displayRows.push({ type: 'option', item, index })
    }

    return { rows: displayRows, selectableItems: selectable }
  }, [groups, value])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const option = listRef.current?.querySelector(`[data-option-index="${activeIndex}"]`)
    if (option) option.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
  }, [])

  const close = () => {
    setOpen(false)
    setActiveIndex(-1)
  }

  const focusInput = () => {
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const selectItem = (item) => {
    if (item.type === 'clear') {
      onChange('')
      close()
      focusInput()
      return
    }
    if (item.type === 'custom') {
      const isCatalogCourse = groups.some((group) => group.courses.includes(value))
      if (isCatalogCourse) onChange('')
      setActiveIndex(-1)
      setOpen(true)
      focusInput()
      return
    }
    onChange(capitalize ? capitalizeWords(item.label) : item.label)
    close()
    focusInput()
  }

  const handleInputChange = (event) => {
    onChange(capitalize ? capitalizeInputValue(event) : event.target.value)
    setOpen(true)
    setActiveIndex(-1)
  }

  const handleFocus = (event) => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setOpen(true)
    event.target.select()
  }

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setOpen(false)
      setActiveIndex(-1)
    }, 150)
  }

  const handleKeyDown = (event) => {
    const total = selectableItems.length

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActiveIndex((prev) => (total ? (prev < 0 ? 0 : (prev + 1) % total) : -1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActiveIndex((prev) => (total ? (prev <= 0 ? total - 1 : prev - 1) : -1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && activeIndex >= 0 && selectableItems[activeIndex]) {
        selectItem(selectableItems[activeIndex])
      } else {
        close()
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'Tab') {
      close()
    }
  }

  const handleClear = () => {
    onChange('')
    setActiveIndex(-1)
    setOpen(true)
    focusInput()
  }

  return (
    <div className="department-select">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="form-input department-select-input"
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        spellCheck="false"
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />

      {value && (
        <button
          type="button"
          className="department-select-clear"
          aria-label="Clear department or major"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleClear}
        >
          <X size={16} />
        </button>
      )}

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Department or major options"
          className="department-select-list"
        >
          {!groups.length && (
            <li role="presentation" className="department-select-hint">
              No matching course. Choose &quot;Other / Enter custom major&quot; below to use your own.
            </li>
          )}

          {rows.map((row) => {
            if (row.type === 'header') {
              return (
                <li key={`group-${row.key}`} role="presentation" className="department-select-group">
                  {row.label}
                </li>
              )
            }

            const { item, index } = row
            const isActive = index === activeIndex
            const isSelected = item.type === 'course' && item.label === value
            const className = [
              'department-select-option',
              isActive ? 'department-select-option-active' : '',
              isSelected ? 'department-select-option-selected' : '',
              item.type === 'custom' ? 'department-select-option-custom' : '',
              item.type === 'clear' ? 'department-select-option-clear' : '',
            ].filter(Boolean).join(' ')

            return (
              <li
                key={`option-${index}-${item.type}`}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                data-option-index={index}
                className={className}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectItem(item)
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {item.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default DepartmentSelect
