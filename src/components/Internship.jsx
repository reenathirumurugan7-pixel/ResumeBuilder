import { Briefcase, Trash2, Plus } from 'lucide-react'
import AiAssistant from './AiAssistant'
import './Internship.css'

function Internship({ entries, onChange }) {
  const addEntry = () => {
    onChange([
      ...entries,
      {
        id: Date.now(),
        company: '',
        role: '',
        duration: '',
        description: '',
      },
    ])
  }

  const removeEntry = (id) => {
    onChange(entries.filter((e) => e.id !== id))
  }

  const handleChange = (id, field, value) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <Briefcase size={20} />
        Internship
      </h3>

      {entries.map((entry, index) => (
        <div className="entry-card" key={entry.id}>
          <div className="entry-header">
            <span className="entry-number">Internship {index + 1}</span>
            <button
              className="entry-remove"
              type="button"
              onClick={() => removeEntry(entry.id)}
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Google / Microsoft"
                value={entry.company}
                onChange={(e) => handleChange(entry.id, 'company', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <input
                type="text"
                className="form-input"
                placeholder="Software Engineering Intern"
                value={entry.role}
                onChange={(e) => handleChange(entry.id, 'role', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Duration</label>
            <input
              type="text"
              className="form-input"
              placeholder="Jun 2023 - Aug 2023"
              value={entry.duration}
              onChange={(e) => handleChange(entry.id, 'duration', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              placeholder="Describe your responsibilities and achievements..."
              value={entry.description}
              onChange={(e) => handleChange(entry.id, 'description', e.target.value)}
              rows={3}
            />
            <AiAssistant
              text={entry.description}
              type="experience"
              label="Improve with AI"
              onApply={(result) => handleChange(entry.id, 'description', result)}
            />
          </div>
        </div>
      ))}

      <button className="add-btn" type="button" onClick={addEntry}>
        <Plus size={16} strokeWidth={2.5} />
        Add Internship
      </button>
    </div>
  )
}

export default Internship
