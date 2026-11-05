import { GraduationCap, Trash2, Plus } from 'lucide-react'
import Typeahead from './Typeahead'
import DepartmentSelect from './DepartmentSelect'
import { colleges, universities } from '../data/institutions'
import './Education.css'

const DEGREE_OPTIONS = [
  '10th / SSLC',
  '12th / HSC',
  'Diploma',
  'ITI',
  'Associate Degree',
  "Bachelor's Degree",
  "Master's Degree",
  'M.Phil',
  'Ph.D',
  'B.E.',
  'B.Tech',
  'M.E.',
  'M.Tech',
  'B.Sc.',
  'M.Sc.',
  'BCA',
  'MCA',
  'B.Com',
  'M.Com',
  'B.A.',
  'M.A.',
  'Other',
]

function getYearOptions(extraYears = []) {
  const currentYear = new Date().getFullYear()
  const startYear = 1980
  const endYear = currentYear + 5
  const years = []
  for (let y = endYear; y >= startYear; y--) {
    years.push(y)
  }
  extraYears.forEach((y) => {
    const n = Number(y)
    if (n && !years.includes(n)) {
      years.push(n)
      years.sort((a, b) => b - a)
    }
  })
  return years
}

function getPercentageOptions() {
  const options = []
  for (let p = 1; p <= 100; p++) {
    options.push(p)
  }
  return options
}

function detectCgpaMode(value) {
  if (typeof value === 'string' && /^\d{1,3}%$/.test(value.trim())) {
    return 'percentage'
  }
  return 'cgpa'
}

function Education({ entries, onChange }) {
  const addEntry = () => {
    onChange([
      ...entries,
      {
        id: Date.now(),
        degree: '',
        department: '',
        college: '',
        university: '',
        startYear: '',
        endYear: '',
        cgpa: '',
        cgpaMode: 'cgpa',
      },
    ])
  }

  const removeEntry = (id) => {
    onChange(entries.filter((e) => e.id !== id))
  }

  const handleChange = (id, field, value) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  const handleCollegeChange = (id, value) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, college: value } : e)))
  }

  const handleUniversityChange = (id, value) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, university: value } : e)))
  }

  const handleCgpaModeChange = (id, mode) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, cgpaMode: mode, cgpa: '' } : e)))
  }

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <GraduationCap size={20} />
        Education
      </h3>

      {entries.map((entry, index) => (
        <div className="entry-card" key={entry.id}>
          <div className="entry-header">
            <span className="entry-number">Education {index + 1}</span>
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
              <label className="form-label">Degree Type</label>
              <Typeahead
                options={DEGREE_OPTIONS}
                value={entry.degree}
                onChange={(value) => handleChange(entry.id, 'degree', value)}
                placeholder="Type or select degree..."
                capitalize
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor={`department-${entry.id}`}>
                Department / Major
              </label>
              <DepartmentSelect
                id={`department-${entry.id}`}
                value={entry.department}
                onChange={(value) => handleChange(entry.id, 'department', value)}
                placeholder="Search department, major, diploma or ITI trade..."
                capitalize
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">College</label>
              <Typeahead
                options={colleges}
                value={entry.college}
                onChange={(value) => handleCollegeChange(entry.id, value)}
                placeholder="Select or type college..."
                minQueryLength={1}
                maxResults={12}
                typeLabel="Type College"
                capitalize
              />
            </div>
            <div className="form-group">
              <label className="form-label">University</label>
              <Typeahead
                options={universities}
                value={entry.university}
                onChange={(value) => handleUniversityChange(entry.id, value)}
                placeholder="Select or type university..."
                minQueryLength={1}
                maxResults={12}
                typeLabel="Type University"
                capitalize
              />
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Start Year</label>
              {(() => {
                const yearOpts = getYearOptions([entry.startYear])
                return (
                  <select
                    className="form-select"
                    value={entry.startYear}
                    onChange={(e) => handleChange(entry.id, 'startYear', e.target.value)}
                  >
                    <option value="">Select year</option>
                    {yearOpts.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                )
              })()}
            </div>
            <div className="form-group">
              <label className="form-label">End Year</label>
              {(() => {
                const yearOpts = getYearOptions([entry.endYear])
                return (
                  <select
                    className="form-select"
                    value={entry.endYear}
                    onChange={(e) => handleChange(entry.id, 'endYear', e.target.value)}
                  >
                    <option value="">Select year</option>
                    {yearOpts.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                )
              })()}
            </div>
            <div className="form-group">
              <label className="form-label">CGPA / Percentage</label>
              <select
                className="form-select cgpa-mode-select"
                value={entry.cgpaMode || detectCgpaMode(entry.cgpa)}
                onChange={(e) => handleCgpaModeChange(entry.id, e.target.value)}
                aria-label="CGPA or Percentage"
              >
                <option value="cgpa">CGPA</option>
                <option value="percentage">Percentage</option>
              </select>
              {entry.cgpaMode === 'percentage' || (!entry.cgpaMode && detectCgpaMode(entry.cgpa) === 'percentage') ? (
                <select
                  className="form-select"
                  value={entry.cgpa.replace('%', '')}
                  onChange={(e) => handleChange(entry.id, 'cgpa', e.target.value ? `${e.target.value}%` : '')}
                >
                  <option value="">Select percentage</option>
                  {getPercentageOptions().map((p) => (
                    <option key={p} value={p}>{p}%</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder="8.5"
                  value={entry.cgpa}
                  onChange={(e) => handleChange(entry.id, 'cgpa', e.target.value)}
                />
              )}
            </div>
          </div>
        </div>
      ))}

      <button className="add-btn" type="button" onClick={addEntry}>
        <Plus size={16} strokeWidth={2.5} />
        Add Education
      </button>
    </div>
  )
}

export default Education
