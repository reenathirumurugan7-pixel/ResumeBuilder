import { Star, X, Plus } from 'lucide-react'
import './Achievements.css'
import { capitalizeInputValue } from '../utils/capitalize'

function Achievements({ entries, onChange }) {
  const addEntry = () => {
    onChange([
      ...entries,
      { id: Date.now(), name: '' },
    ])
  }

  const removeEntry = (id) => {
    onChange(entries.filter((e) => e.id !== id))
  }

  const handleChange = (id, value) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, name: value } : e)))
  }

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <Star size={20} />
        Achievements
      </h3>

      {entries.map((entry, index) => (
        <div className="achievement-entry" key={entry.id}>
          <div className="achievement-row">
            <span className="entry-number">{index + 1}</span>
            <input
              type="text"
              className="form-input achievement-input"
              placeholder="Won 1st place in hackathon..."
              value={entry.name}
              onChange={(e) => handleChange(entry.id, capitalizeInputValue(e))}
            />
            <button
              className="entry-remove"
              type="button"
              onClick={() => removeEntry(entry.id)}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}

      <button className="add-btn" type="button" onClick={addEntry}>
        <Plus size={16} strokeWidth={2.5} />
        Add Achievement
      </button>
    </div>
  )
}

export default Achievements
