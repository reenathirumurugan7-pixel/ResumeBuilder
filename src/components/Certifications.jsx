import { Award, X, Plus } from 'lucide-react'
import './Certifications.css'

function Certifications({ entries, onChange }) {
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
        <Award size={20} />
        Certifications
      </h3>

      {entries.map((entry, index) => (
        <div className="cert-entry" key={entry.id}>
          <div className="cert-row">
            <span className="entry-number">{index + 1}</span>
            <input
              type="text"
              className="form-input cert-input"
              placeholder="AWS Certified Cloud Practitioner"
              value={entry.name}
              onChange={(e) => handleChange(entry.id, e.target.value)}
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
        Add Certification
      </button>
    </div>
  )
}

export default Certifications
