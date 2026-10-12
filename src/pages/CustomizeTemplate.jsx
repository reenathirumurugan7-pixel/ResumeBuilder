import { useState, useCallback, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTemplate } from '../context/TemplateContext'
import { findTemplate, templateDefaultConfig, colorPresets, fontOptions, layoutOptions, headerOptions, allSectionKeys, sectionLabels } from '../config/customize'
import LiveResumePreview from '../components/LiveResumePreview'
import { PHOTO_EDGE_PX, normalizePhoto } from '../utils/photo'
import './CustomizeTemplate.css'

const demoData = {
  personalInfo: {
    fullName: 'Reena Thirumurugan',
    email: 'reenaajith@gmail.com',
    phone: '+1 234 567 890',
    location: 'New York, NY',
    linkedin: 'linkedin.com/in/reena',
    github: 'github.com/reena',
    portfolio: '',
  },
  careerObjective: 'Results-driven Software Engineer with 3+ years of experience building responsive web applications and scalable backend services. Skilled in React, JavaScript, Node.js, Python, SQL, and REST APIs, with a strong focus on clean code, performance, and user experience.',
  professionalSummary: 'Results-driven Software Engineer with 3+ years of experience building responsive web applications and scalable backend services. Skilled in React, JavaScript, Node.js, Python, SQL, and REST APIs, with a strong focus on clean code, performance, and user experience.',
  education: [
    { id: 1, degree: 'Bachelor of Science', department: 'Computer Science', college: 'State University', university: '', startYear: '2018', endYear: '2021', cgpa: '' },
  ],
  skills: ['React', 'JavaScript', 'Node.js', 'Python', 'HTML', 'CSS', 'SQL', 'REST APIs', 'Git', 'GitHub', 'MongoDB', 'Firebase'],
  languages: [
    { name: 'English', proficiency: 'Fluent' },
    { name: 'Spanish', proficiency: 'Intermediate' },
  ],
  projects: [
    { id: 1, title: 'E-Commerce Web Application', technologies: 'React, Node.js, Express, MongoDB', description: 'Built a responsive full-stack e-commerce platform using React, Node.js, Express, and MongoDB with product management, authentication, shopping cart, and order processing.', link: '' },
    { id: 2, title: 'AI Resume Analyzer', technologies: 'React, JavaScript, Python, AI, REST API', description: 'Developed an AI-powered resume analysis application that evaluates resume content, identifies missing keywords, and provides improvement suggestions for better ATS compatibility.', link: '' },
  ],
  workExperience: [
    { id: 1, jobTitle: 'Software Engineer', company: 'TechNova Solutions', location: 'New York, NY', startDate: '2023', endDate: 'Present', responsibilities: 'Developed responsive web applications using React and JavaScript; built REST APIs using Node.js and Express; improved application performance by optimizing API requests and database queries; collaborated with designers and developers using Git and Agile workflows.' },
    { id: 2, jobTitle: 'Junior Software Developer', company: 'DigitalWorks Inc.', location: 'New York, NY', startDate: '2021', endDate: '2023', responsibilities: 'Developed reusable frontend components using React; created backend services and database queries; fixed production bugs and improved application reliability; participated in code reviews and sprint planning.' },
  ],
  internship: [],
  certifications: [
    { id: 1, name: 'Python Programming Certification' },
    { id: 2, name: 'Web Development Certification' },
    { id: 3, name: 'SQL Database Certification' },
  ],
  achievements: [
    { id: 1, name: 'Developed and deployed multiple full-stack web applications.' },
    { id: 2, name: 'Successfully improved application performance through frontend and backend optimization.' },
    { id: 3, name: 'Participated in software development projects using Agile methodologies.' },
  ],
}

function CustomizeTemplate() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { applyConfig, saveCustomTemplate, duplicateTemplate } = useTemplate()

  const baseTemplate = findTemplate(templateId)
  const [config, setConfig] = useState(() => templateDefaultConfig(baseTemplate))
  const [resumeType, setResumeType] = useState('fresher')
  const [activeTab, setActiveTab] = useState('colors')
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  const showToast = (text) => {
    setToast(text)
    setTimeout(() => setToast(null), 2500)
  }

  const update = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateColors = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, ...patch } }))
  }, [])

  const updateFonts = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, fonts: { ...prev.fonts, ...patch } }))
  }, [])

  const updateSpacing = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, spacing: { ...prev.spacing, ...patch } }))
  }, [])

  const applyPreset = (preset) => {
    updateColors(preset.colors)
    showToast(`Theme: ${preset.label}`)
  }

  const toggleSection = (key) => {
    setConfig((prev) => {
      const hidden = prev.hiddenSections.includes(key)
        ? prev.hiddenSections.filter((s) => s !== key)
        : [...prev.hiddenSections, key]
      return { ...prev, hiddenSections: hidden }
    })
  }

  const moveSection = (index, dir) => {
    setConfig((prev) => {
      const sections = [...prev.sections]
      const target = index + dir
      if (target < 0 || target >= sections.length) return prev
      const temp = sections[index]
      sections[index] = sections[target]
      sections[target] = temp
      return { ...prev, sections }
    })
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files && e.target.files[0]
    // Reset immediately so re-picking the same file still fires a change event.
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    try {
      const photo = await normalizePhoto(file)
      update({ photo })
      showToast('Photo updated')
    } catch (err) {
      showToast(err.message || 'That photo could not be used.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleRemovePhoto = () => update({ photo: null })

  const handleReset = () => {
    setConfig(templateDefaultConfig(baseTemplate))
    setConfirmReset(false)
    showToast('Reset to default')
  }

  const handleSave = () => {
    saveCustomTemplate(config, `${baseTemplate.name} Custom`)
    showToast('Custom template saved')
  }

  const handleDuplicate = () => {
    duplicateTemplate(config, 'My Custom Template')
    showToast('Duplicated as My Custom Template')
  }

  const handleUse = () => {
    applyConfig(config)
    navigate('/resume-type')
  }

  const tabs = [
    { id: 'colors', label: 'Colors' },
    { id: 'fonts', label: 'Fonts' },
    { id: 'layout', label: 'Layout' },
    { id: 'sections', label: 'Sections' },
    { id: 'header', label: 'Header' },
    { id: 'photo', label: 'Photo' },
    { id: 'spacing', label: 'Spacing' },
  ]

  const orderedVisibleSections = config.sections.filter((s) => !config.hiddenSections.includes(s))

  return (
    <div className="customize-page">
      <div className="customize-header">
        <div className="container customize-header-inner">
          <Link to="/templates" className="customize-back">Back to Templates</Link>
          <div className="customize-title-wrap">
            <h1 className="customize-title">Customize {baseTemplate.name}</h1>
          </div>
        </div>
        <div className="container customize-sticky-actions">
          {/* Reset is destructive, so it opens the confirmation first; handleReset
              only runs once the user confirms in that modal. */}
          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmReset(true)}>Reset</button>
          <button className="btn btn-secondary btn-sm" onClick={handleSave}>Save Template</button>
          <button className="btn btn-secondary btn-sm" onClick={handleDuplicate}>Duplicate</button>
          <button className="btn btn-primary btn-sm" onClick={handleUse}>Use Template</button>
        </div>
      </div>

      <div className="container customize-layout">
        <div className="customize-controls">
          <div className="customize-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`customize-tab ${activeTab === t.id ? 'customize-tab-active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="customize-panel">
            {activeTab === 'colors' && (
              <>
                <div className="customize-group">
                  <h3 className="customize-group-title">Preset Themes</h3>
                  <div className="customize-preset-grid">
                    {colorPresets.map((p) => (
                      <button
                        key={p.id}
                        className="customize-preset"
                        onClick={() => applyPreset(p)}
                        title={p.label}
                      >
                        {p.colors.primary}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="customize-group">
                  <h3 className="customize-group-title">Colors</h3>
                  <ColorControl label="Primary Color" value={config.colors.primary} onChange={(v) => updateColors({ primary: v })} />
                  <ColorControl label="Secondary Color" value={config.colors.secondary} onChange={(v) => updateColors({ secondary: v })} />
                  <ColorControl label="Accent Color" value={config.colors.accent} onChange={(v) => updateColors({ accent: v })} />
                  <ColorControl label="Background Color" value={config.colors.background} onChange={(v) => updateColors({ background: v })} />
                  <ColorControl label="Text Color" value={config.colors.text} onChange={(v) => updateColors({ text: v })} />
                </div>
              </>
            )}

            {activeTab === 'fonts' && (
              <>
                <div className="customize-group">
                  <h3 className="customize-group-title">Fonts</h3>
                  <SelectControl
                    label="Heading Font"
                    value={config.fonts.heading}
                    options={fontOptions.map((f) => ({ value: f.id, label: f.label }))}
                    onChange={(v) => updateFonts({ heading: v })}
                  />
                  <SelectControl
                    label="Body Font"
                    value={config.fonts.body}
                    options={fontOptions.map((f) => ({ value: f.id, label: f.label }))}
                    onChange={(v) => updateFonts({ body: v })}
                  />
                  <div className="customize-field">
                    <label className="customize-label">Font Size <span>{config.fonts.size}px</span></label>
                    <input
                      type="range"
                      min="11"
                      max="20"
                      value={config.fonts.size}
                      onChange={(e) => updateFonts({ size: Number(e.target.value) })}
                      className="customize-range"
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'layout' && (
              <div className="customize-group">
                <h3 className="customize-group-title">Layout</h3>
                <div className="customize-option-grid">
                  {layoutOptions.map((o) => (
                    <button
                      key={o.id}
                      className={`customize-option ${config.layout === o.id ? 'customize-option-active' : ''}`}
                      onClick={() => update({ layout: o.id })}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'sections' && (
              <div className="customize-group">
                <h3 className="customize-group-title">Section Visibility</h3>
                {allSectionKeys.map((key) => (
                  <div className="customize-toggle-row" key={key}>
                    <label className="customize-toggle-label">
                      <input
                        type="checkbox"
                        checked={!config.hiddenSections.includes(key)}
                        onChange={() => toggleSection(key)}
                      />
                      {sectionLabels[key]}
                    </label>
                  </div>
                ))}

                <h3 className="customize-group-title customize-group-mt">Section Order</h3>
                {orderedVisibleSections.map((key, index) => (
                  <div className="customize-order-row" key={key}>
                    <span className="customize-order-index">{index + 1}</span>
                    <span className="customize-order-name">{sectionLabels[key]}</span>
                    <div className="customize-order-btns">
                      <button
                        className="customize-order-btn"
                        onClick={() => moveSection(config.sections.indexOf(key), -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                      >↑</button>
                      <button
                        className="customize-order-btn"
                        onClick={() => moveSection(config.sections.indexOf(key), 1)}
                        disabled={index === orderedVisibleSections.length - 1}
                        aria-label="Move down"
                      >↓</button>
                    </div>
                  </div>
                ))}
                <p className="customize-hint">Move sections up/down to reorder your resume.</p>
              </div>
            )}

            {activeTab === 'header' && (
              <div className="customize-group">
                <h3 className="customize-group-title">Header Style</h3>
                <div className="customize-option-grid">
                  {headerOptions.map((o) => (
                    <button
                      key={o.id}
                      className={`customize-option ${config.headerStyle === o.id ? 'customize-option-active' : ''}`}
                      onClick={() => update({ headerStyle: o.id })}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <h3 className="customize-group-title customize-group-mt">Icons</h3>
                <div className="customize-toggle-row">
                  <label className="customize-toggle-label">
                    <input
                      type="checkbox"
                      checked={config.showIcons}
                      onChange={(e) => update({ showIcons: e.target.checked })}
                    />
                    Show Icons in Resume
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'photo' && (
              <div className="customize-group">
                <h3 className="customize-group-title">Profile Photo</h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
                <div className="customize-photo-preview">
                  {config.photo ? (
                    <img
                      src={config.photo}
                      alt="Profile"
                      className={`customize-photo-img ${config.photoShape === 'circle' ? 'customize-photo-circle' : 'customize-photo-square'}`}
                    />
                  ) : (
                    <div className="customize-photo-placeholder">No photo</div>
                  )}
                </div>
                <p className="customize-hint">
                  JPG, PNG or WEBP up to 5 MB. Photos are resized to {PHOTO_EDGE_PX}px so your resume still saves.
                </p>
                <div className="customize-btn-row">
                  <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current.click()} disabled={photoBusy}>
                    {photoBusy ? 'Processing…' : 'Upload Photo'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleRemovePhoto} disabled={!config.photo || photoBusy}>Remove Photo</button>
                </div>
                <div className="customize-field">
                  <label className="customize-label">Photo Shape</label>
                  <div className="customize-option-grid">
                    <button
                      className={`customize-option ${config.photoShape === 'circle' ? 'customize-option-active' : ''}`}
                      onClick={() => update({ photoShape: 'circle' })}
                    >Circle</button>
                    <button
                      className={`customize-option ${config.photoShape === 'square' ? 'customize-option-active' : ''}`}
                      onClick={() => update({ photoShape: 'square' })}
                    >Square</button>
                  </div>
                </div>
                <div className="customize-field">
                  <label className="customize-label">Photo Size <span>{Math.round(config.photoScale * 100)}%</span></label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.4"
                    step="0.1"
                    value={config.photoScale}
                    onChange={(e) => update({ photoScale: Number(e.target.value) })}
                    className="customize-range"
                    disabled={!config.photo}
                  />
                </div>
              </div>
            )}

            {activeTab === 'spacing' && (
              <div className="customize-group">
                <h3 className="customize-group-title">Spacing</h3>
                <RangeControl label="Margins" value={config.spacing.margin} min={16} max={64} unit="px" onChange={(v) => updateSpacing({ margin: v })} />
                <RangeControl label="Padding" value={config.spacing.padding} min={12} max={48} unit="px" onChange={(v) => updateSpacing({ padding: v })} />
                <RangeControl label="Section Spacing" value={config.spacing.section} min={8} max={40} unit="px" onChange={(v) => updateSpacing({ section: v })} />
                <RangeControl label="Line Spacing" value={config.spacing.line} min={0} max={16} unit="px" onChange={(v) => updateSpacing({ line: v })} />
              </div>
            )}
          </div>
        </div>

        <div className="customize-preview">
          <div className="customize-preview-toolbar">
            <div className="customize-resume-type">
              <button
                className={`customize-type-btn ${resumeType === 'fresher' ? 'customize-type-active' : ''}`}
                onClick={() => setResumeType('fresher')}
              >Fresher</button>
              <button
                className={`customize-type-btn ${resumeType === 'experienced' ? 'customize-type-active' : ''}`}
                onClick={() => setResumeType('experienced')}
              >Experienced</button>
            </div>
          </div>
          <div className="customize-preview-scroll">
            <LiveResumePreview config={config} data={demoData} resumeType={resumeType} className="customize-live-preview" />
          </div>
        </div>
      </div>

      {confirmReset && (
        <div className="customize-modal">
          <div className="customize-modal-content">
            <h3>Reset to default?</h3>
            <p>This will discard all your customization changes for this template.</p>
            <div className="customize-modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleReset}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="customize-toast">{toast}</div>}
    </div>
  )
}

function ColorControl({ label, value, onChange }) {
  return (
    <div className="customize-field">
      <label className="customize-label">{label}</label>
      <div className="customize-color-input">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="customize-color-swatch"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="customize-color-hex"
        />
      </div>
    </div>
  )
}

function SelectControl({ label, value, options, onChange }) {
  return (
    <div className="customize-field">
      <label className="customize-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="customize-select">
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ fontFamily: o.value }}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function RangeControl({ label, value, min, max, unit, onChange }) {
  return (
    <div className="customize-field">
      <label className="customize-label">{label} <span>{value}{unit}</span></label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="customize-range"
      />
    </div>
  )
}

export default CustomizeTemplate
