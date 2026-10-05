import { Folder, Trash2, Plus } from 'lucide-react'
import AiAssistant from './AiAssistant'
import './Projects.css'

function Projects({ entries, onChange }) {
  const addEntry = () => {
    onChange([
      ...entries,
      {
        id: Date.now(),
        title: '',
        description: '',
        technologies: '',
        link: '',
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
        <Folder size={20} />
        Projects
      </h3>

      {entries.map((entry, index) => (
        <div className="entry-card" key={entry.id}>
          <div className="entry-header">
            <span className="entry-number">Project {index + 1}</span>
            <button
              className="entry-remove"
              type="button"
              onClick={() => removeEntry(entry.id)}
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Project Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="E-Commerce Platform"
              value={entry.title}
              onChange={(e) => handleChange(entry.id, 'title', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              placeholder="Brief description of the project..."
              value={entry.description}
              onChange={(e) => handleChange(entry.id, 'description', e.target.value)}
              rows={3}
            />
            <AiAssistant
              text={entry.description}
              type="projects"
              label="Improve with AI"
              onApply={(result) => handleChange(entry.id, 'description', result)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Technologies Used</label>
              <input
                type="text"
                className="form-input"
                placeholder="React, Node.js, MongoDB"
                value={entry.technologies}
                onChange={(e) => handleChange(entry.id, 'technologies', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Project Link</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://github.com/..."
                value={entry.link}
                onChange={(e) => handleChange(entry.id, 'link', e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      <button className="add-btn" type="button" onClick={addEntry}>
        <Plus size={16} strokeWidth={2.5} />
        Add Project
      </button>
    </div>
  )
}

export default Projects
