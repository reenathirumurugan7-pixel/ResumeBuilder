import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Heart, Eye, Check, Settings } from 'lucide-react'
import templates, { categories } from '../data/templates'
import { useTemplate } from '../context/TemplateContext'
import './Templates.css'

const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'ats', label: 'ATS Score' },
  { value: 'alpha', label: 'Alphabetical' },
  { value: 'recommended', label: 'Recommended' },
]

function TemplatePreviewMini({ template }) {
  const c = template.colorTheme
  const ps = template.previewStyle
  const isDark = template.id === 'modern-dark' || template.id === 'minimal-black'

  return (
    <div className="tpl-mini" style={{ background: isDark ? '#1E293B' : '#fff' }}>
      <div className="tpl-mini-header" style={{ background: ps.headerBg, textAlign: ps.headerAlign, color: '#fff' }}>
        <div className="tpl-mini-name">John Doe</div>
        <div className="tpl-mini-contact">john@email.com | +1 234 567</div>
      </div>
      <div className="tpl-mini-body" style={{ color: c.text }}>
        <div className="tpl-mini-section" style={{ color: c.primary }}>Experience</div>
        <div className="tpl-mini-line" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
        <div className="tpl-mini-line tpl-mini-line-75" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
        <div className="tpl-mini-line tpl-mini-line-50" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
        <div className="tpl-mini-section" style={{ color: c.primary }}>Skills</div>
        <div className="tpl-mini-skills">
          {['React', 'Node.js', 'Python'].map(s => (
            <span key={s} className="tpl-mini-skill" style={{ background: isDark ? '#334155' : c.bg, color: c.primary, borderColor: isDark ? '#475569' : c.accent + '40' }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function TemplatePreviewFull({ template }) {
  const c = template.colorTheme
  const ps = template.previewStyle
  const isDark = template.id === 'modern-dark' || template.id === 'minimal-black'

  return (
    <div className="tpl-full" style={{ background: isDark ? '#1E293B' : '#fff' }}>
      <div className="tpl-full-header" style={{ background: ps.headerBg, textAlign: ps.headerAlign, color: '#fff' }}>
        <div className="tpl-full-name">John Doe</div>
        <div className="tpl-full-contact">john@email.com | +1 234 567 890 | New York, NY</div>
        <div className="tpl-full-links">linkedin.com/in/johndoe | github.com/johndoe</div>
      </div>
      <div className="tpl-full-body" style={{ color: c.text }}>
        <div className="tpl-full-section">
          <div className="tpl-full-section-title" style={{ color: c.primary, borderBottomColor: c.accent + '40' }}>Experience</div>
          <div className="tpl-full-entry">
            <div className="tpl-full-entry-title">Senior Software Engineer</div>
            <div className="tpl-full-entry-sub">Tech Corp | Jan 2022 - Present</div>
            <div className="tpl-full-line" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
            <div className="tpl-full-line tpl-full-line-85" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
            <div className="tpl-full-line tpl-full-line-70" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
          </div>
          <div className="tpl-full-entry">
            <div className="tpl-full-entry-title">Software Developer</div>
            <div className="tpl-full-entry-sub">StartupXYZ | Jun 2020 - Dec 2021</div>
            <div className="tpl-full-line" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
            <div className="tpl-full-line tpl-full-line-60" style={{ background: isDark ? '#334155' : '#E2E8F0' }}></div>
          </div>
        </div>
        <div className="tpl-full-section">
          <div className="tpl-full-section-title" style={{ color: c.primary, borderBottomColor: c.accent + '40' }}>Education</div>
          <div className="tpl-full-entry">
            <div className="tpl-full-entry-title">B.Tech in Computer Science</div>
            <div className="tpl-full-entry-sub">University of Technology | 2016 - 2020</div>
          </div>
        </div>
        <div className="tpl-full-section">
          <div className="tpl-full-section-title" style={{ color: c.primary, borderBottomColor: c.accent + '40' }}>Skills</div>
          <div className="tpl-full-skills">
            {['React', 'Node.js', 'Python', 'TypeScript', 'AWS', 'Docker'].map(s => (
              <span key={s} className="tpl-full-skill" style={{ background: isDark ? '#334155' : c.bg, color: c.primary, borderColor: isDark ? '#475569' : c.accent + '40' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplatePreviewModal({ template, onClose, onUseTemplate, onCustomize }) {
  const handleCustomize = () => onCustomize(template)

  return (
    <div className="tpl-modal-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tpl-modal-close" onClick={onClose}>
          <X size={24} />
        </button>
        <div className="tpl-modal-content">
          <div className="tpl-modal-preview">
            <TemplatePreviewFull template={template} />
          </div>
          <div className="tpl-modal-info">
            <span className="tpl-modal-category">{template.category[0]}</span>
            <h2 className="tpl-modal-name">{template.name}</h2>
            <p className="tpl-modal-desc">{template.description}</p>
            <div className="tpl-modal-meta">
              <div className="tpl-modal-ats">
                <span className="tpl-modal-ats-label">ATS Score</span>
                <span className="tpl-modal-ats-value">{template.atsScore}/100</span>
              </div>
              <div className="tpl-modal-layout">
                <span className="tpl-modal-layout-label">Layout</span>
                <span className="tpl-modal-layout-value" style={{ textTransform: 'capitalize' }}>{template.layout}</span>
              </div>
            </div>
            <div className="tpl-modal-actions">
              <button className="btn btn-primary tpl-modal-use" onClick={onUseTemplate}>
                <Check size={16} />
                Use Template
              </button>
              <button className="btn btn-secondary tpl-modal-customize" onClick={handleCustomize}>
                <Settings size={16} />
                Customize
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, isFavorite, onToggleFavorite, onPreview, onSelect, onCustomize }) {
  return (
    <div className="template-card">
      <div className="template-card-preview">
        <TemplatePreviewMini template={template} />
        <div className="template-card-overlay">
          <button className="tpl-overlay-btn" onClick={() => onPreview(template)}>
            <Eye size={16} />
            Preview
          </button>
        </div>
        <button
          className={`tpl-fav-btn ${isFavorite ? 'tpl-fav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(template.id); }}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? (
            <Heart size={16} fill="currentColor" />
          ) : (
            <Heart size={16} />
          )}
        </button>
        {template.atsScore >= 95 && <span className="tpl-badge tpl-badge-ats">ATS+</span>}
      </div>

      <div className="template-card-info">
        <div className="template-card-header">
          <h3 className="template-card-name">{template.name}</h3>
          <span className="template-card-ats">{template.atsScore}% ATS</span>
        </div>
        <p className="template-card-desc">{template.description}</p>
        <div className="template-card-tags">
          {template.category.map(cat => (
            <span key={cat} className="template-card-tag">{cat}</span>
          ))}
        </div>
        <div className="template-card-actions">
          <button className="btn btn-primary btn-sm template-card-use" onClick={() => onSelect(template)}>
            Use Template
          </button>
          <button className="btn btn-secondary btn-sm template-card-preview" onClick={() => onPreview(template)}>
            <Eye size={14} />
            Preview
          </button>
          <button className="btn btn-secondary btn-sm template-card-customize" onClick={() => onCustomize(template)}>
            <Settings size={14} />
            Customize
          </button>
        </div>
      </div>
    </div>
  )
}

function Templates() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All Templates')
  const [sortBy, setSortBy] = useState('popular')
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tpl_favorites') || '[]')
    } catch {
      return []
    }
  })
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)

  const { selectTemplate } = useTemplate()
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.setItem('tpl_favorites', JSON.stringify(favorites))
  }, [favorites])

  const toggleFavorite = useCallback((id) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }, [])

  const handleSelectTemplate = useCallback((template) => {
    selectTemplate(template.id)
    navigate('/resume-type')
  }, [selectTemplate, navigate])

  const handleCustomize = useCallback((template) => {
    selectTemplate(template.id)
    navigate(`/customize/${template.id}`)
  }, [selectTemplate, navigate])

  const filtered = useMemo(() => {
    let result = [...templates]

    if (activeCategory !== 'All Templates') {
      result = result.filter(t => t.category.includes(activeCategory))
    }

    if (showOnlyFavorites) {
      result = result.filter(t => favorites.includes(t.id))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.some(c => c.toLowerCase().includes(q)) ||
        t.keywords.some(k => k.toLowerCase().includes(q))
      )
    }

    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.popularity - a.popularity)
        break
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        break
      case 'ats':
        result.sort((a, b) => b.atsScore - a.atsScore)
        break
      case 'alpha':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'recommended':
        result.sort((a, b) => (b.atsScore * 0.6 + b.popularity * 0.004) - (a.atsScore * 0.6 + a.popularity * 0.004))
        break
      default:
        break
    }

    return result
  }, [activeCategory, search, sortBy, showOnlyFavorites, favorites])

  return (
    <div className="templates-page">
      <div className="container">
        <div className="templates-header">
          <h1 className="templates-title">Choose Your Resume Template</h1>
          <p className="templates-subtitle">
            Select from professionally designed templates to build your perfect resume.
          </p>
        </div>

        <div className="templates-controls">
          <div className="templates-search">
            <Search size={18} className="templates-search-icon-svg" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="templates-search-input"
            />
            {search && (
              <button className="templates-search-clear" onClick={() => setSearch('')}>
                <X size={16} />
              </button>
            )}
          </div>

          <div className="templates-sort">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="templates-sort-select">
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            className={`templates-fav-toggle ${showOnlyFavorites ? 'templates-fav-toggle-active' : ''}`}
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
          >
            <Heart size={16} fill={showOnlyFavorites ? 'currentColor' : 'none'} />
            Favorites
          </button>
        </div>

        <div className="templates-categories">
          {categories.map(cat => (
            <button
              key={cat}
              className={`templates-category-btn ${activeCategory === cat ? 'templates-category-active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="templates-count">
          {filtered.length} template{filtered.length !== 1 ? 's' : ''} found
        </div>

        <div className="templates-grid">
          {filtered.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isFavorite={favorites.includes(template.id)}
              onToggleFavorite={toggleFavorite}
              onPreview={setPreviewTemplate}
              onSelect={handleSelectTemplate}
              onCustomize={handleCustomize}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="templates-empty">
            <Search size={48} style={{ opacity: 0.4, marginBottom: 16 }} />
            <h3>No templates found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUseTemplate={() => handleSelectTemplate(previewTemplate)}
          onCustomize={handleCustomize}
        />
      )}
    </div>
  )
}

export default Templates
