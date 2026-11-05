import { Briefcase, Trash2, Plus } from 'lucide-react'
import AiAssistant from './AiAssistant'
import './WorkExperience.css'
import { capitalizeInputValue } from '../utils/capitalize'

function WorkExperience({ entries, onChange }) {
  const addEntry = () => {
    onChange([
      ...entries,
      {
        id: Date.now(),
        company: '',
        jobTitle: '',
        location: '',
        startDate: '',
        endDate: '',
        responsibilities: '',
      },
    ])
  }

  const removeEntry = (id) => {
    onChange(entries.filter((e) => e.id !== id))
  }

  const handleChange = (id, field, value) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  const handleTextChange = (id, field, event) => {
    handleChange(id, field, capitalizeInputValue(event))
  }

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <Briefcase size={20} />
        Work Experience
      </h3>

      {entries.map((entry, index) => (
        <div className="entry-card" key={entry.id}>
          <div className="entry-header">
            <span className="entry-number">Experience {index + 1}</span>
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
                placeholder="Google"
                value={entry.company}
                onChange={(e) => handleTextChange(entry.id, 'company', e)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="Software Engineer"
                value={entry.jobTitle}
                onChange={(e) => handleTextChange(entry.id, 'jobTitle', e)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Location</label>
            <input
              type="text"
              className="form-input"
              placeholder="San Francisco, CA"
              value={entry.location}
              onChange={(e) => handleTextChange(entry.id, 'location', e)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="text"
                className="form-input"
                placeholder="Jan 2022"
                value={entry.startDate}
                onChange={(e) => handleChange(entry.id, 'startDate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="text"
                className="form-input"
                placeholder="Present"
                value={entry.endDate}
                onChange={(e) => handleChange(entry.id, 'endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Responsibilities</label>
            <textarea
              className="form-textarea"
              placeholder="Describe your responsibilities, achievements, and impact..."
              value={entry.responsibilities}
              onChange={(e) => handleChange(entry.id, 'responsibilities', e.target.value)}
              rows={4}
            />
            <AiAssistant
              text={entry.responsibilities}
              type="experience"
              label="Improve with AI"
              onApply={(result) => handleChange(entry.id, 'responsibilities', result)}
            />
          </div>
        </div>
      ))}

      <button className="add-btn" type="button" onClick={addEntry}>
        <Plus size={16} strokeWidth={2.5} />
        Add Experience
      </button>
    </div>
  )
}

export default WorkExperience
