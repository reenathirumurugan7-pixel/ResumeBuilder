import { useMemo } from 'react'
import { resolveConfig } from '../config/customize'
import ResumeQRCode from './ResumeQRCode'
import { resumeQrUrl } from '../utils/resumeStorage'
import './LiveResumePreview.css'

function Icon({ name }) {
  const common = { width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'summary':
      return <svg {...common}><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
    case 'education':
      return <svg {...common}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
    case 'skills':
      return <svg {...common}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    case 'projects':
      return <svg {...common}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    case 'experience':
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    case 'internship':
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    case 'certifications':
      return <svg {...common}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
    case 'achievements':
      return <svg {...common}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    case 'languages':
      return <svg {...common}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    case 'briefcase':
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    case 'mail':
      return <svg {...common}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    case 'phone':
      return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    case 'location':
      return <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    case 'linkedin':
      return <svg {...common}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4V8h4v2a6 6 0 0 1 2-2z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
    case 'github':
      return <svg {...common}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
    case 'link':
      return <svg {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    case 'user':
      return <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    default:
      return null
  }
}

function SectionTitle({ config, label, icon }) {
  const accent = config.colors.accent
  return (
    <div className="lrp-section-title-row" style={{ marginBottom: config.spacing.line + 2 }}>
      {config.showIcons && icon && (
        <span className="lrp-section-icon" style={{ color: config.colors.primary }}><Icon name={icon} /></span>
      )}
      <span className="lrp-section-title-text" style={{ fontFamily: config.fonts.heading, color: config.colors.primary }}>
        {label}
      </span>
      <span className="lrp-section-title-line" style={{ background: accent }} />
    </div>
  )
}

function SectionBlock({ config }) {
  const data = config.data
  const resumeType = config.resumeType
  const sections = config.sections.filter((s) => !config.hiddenSections.includes(s))

  return sections.map((key) => {
    if (key === 'languages') {
      return <LanguagesBlock config={config} key="languages" />
    }

    if (key === 'summary') {
      const text = resumeType === 'experienced' ? data.professionalSummary : data.careerObjective
      if (!text) return null
      return (
        <section className="lrp-section" key="summary" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label={resumeType === 'experienced' ? 'Professional Summary' : 'Career Objective'} icon="summary" />
          <p className="lrp-text" style={{ fontFamily: config.fonts.body, color: config.colors.text, marginBottom: config.spacing.line }}>
            {text}
          </p>
        </section>
      )
    }

    if (key === 'education') {
      if (!data.education?.length) return null
      return (
        <section className="lrp-section" key="education" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label="Education" icon="education" />
          {data.education.map((edu, i) => {
            const degree = [edu.degree, edu.department].filter(Boolean).join(' in ')
            const school = [edu.college, edu.university].filter(Boolean).join(', ')
            const years = [edu.startYear, edu.endYear].filter(Boolean).join(' - ')
            return (
              <div className="lrp-entry" key={i} style={{ marginBottom: config.spacing.line + 4 }}>
                <div className="lrp-entry-head" style={{ fontFamily: config.fonts.heading }}>
                  <span className="lrp-entry-title">{degree || 'Degree'}</span>
                  {years && <span className="lrp-entry-date" style={{ color: config.colors.secondary }}>{years}</span>}
                </div>
                {school && <div className="lrp-entry-sub" style={{ color: config.colors.secondary }}>{school}</div>}
                {edu.cgpa && <div className="lrp-entry-sub" style={{ color: config.colors.secondary }}>{String(edu.cgpa).trim().endsWith('%') ? 'Percentage' : 'CGPA'}: {edu.cgpa}</div>}
              </div>
            )
          })}
        </section>
      )
    }

    if (key === 'skills') {
      if (!data.skills?.length) return null
      return (
        <section className="lrp-section" key="skills" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label="Skills" icon="skills" />
          <div className="lrp-skills">
            {data.skills.map((skill, i) => (
              <span key={i} className="lrp-skill" style={{ borderColor: config.colors.accent + '55', color: config.colors.primary, background: config.colors.background }}>
                {skill}
              </span>
            ))}
          </div>
        </section>
      )
    }

    if (key === 'projects') {
      if (!data.projects?.length) return null
      return (
        <section className="lrp-section" key="projects" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label="Projects" icon="projects" />
          {data.projects.map((proj, i) => (
            <div className="lrp-entry" key={i} style={{ marginBottom: config.spacing.line + 4 }}>
              <div className="lrp-entry-head" style={{ fontFamily: config.fonts.heading }}>
                <span className="lrp-entry-title">{proj.title || 'Project'}</span>
                {proj.technologies && <span className="lrp-entry-date" style={{ color: config.colors.secondary }}>{proj.technologies}</span>}
              </div>
              {proj.description && <div className="lrp-text" style={{ color: config.colors.text, marginBottom: config.spacing.line }}>{proj.description}</div>}
              {proj.link && (
                <div className="lrp-link" style={{ color: config.colors.accent }}>
                  {config.showIcons && <Icon name="link" />} {proj.link}
                </div>
              )}
            </div>
          ))}
        </section>
      )
    }

    if (key === 'experience') {
      if (resumeType !== 'experienced' || !data.workExperience?.length) return null
      return (
        <section className="lrp-section" key="experience" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label="Work Experience" icon="experience" />
          {data.workExperience.map((exp, i) => {
            const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ')
            return (
              <div className="lrp-entry" key={i} style={{ marginBottom: config.spacing.line + 4 }}>
                <div className="lrp-entry-head" style={{ fontFamily: config.fonts.heading }}>
                  <span className="lrp-entry-title">{exp.jobTitle || 'Job Title'}</span>
                  {dates && <span className="lrp-entry-date" style={{ color: config.colors.secondary }}>{dates}</span>}
                </div>
                {exp.company && <div className="lrp-entry-sub" style={{ color: config.colors.secondary }}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</div>}
                {exp.responsibilities && <div className="lrp-text" style={{ color: config.colors.text, marginBottom: config.spacing.line }}>{exp.responsibilities}</div>}
              </div>
            )
          })}
        </section>
      )
    }

    if (key === 'internship') {
      if (resumeType !== 'fresher' || !data.internship?.length) return null
      return (
        <section className="lrp-section" key="internship" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label="Internship" icon="internship" />
          {data.internship.map((intern, i) => (
            <div className="lrp-entry" key={i} style={{ marginBottom: config.spacing.line + 4 }}>
              <div className="lrp-entry-head" style={{ fontFamily: config.fonts.heading }}>
                <span className="lrp-entry-title">{intern.role || 'Role'}</span>
                {intern.duration && <span className="lrp-entry-date" style={{ color: config.colors.secondary }}>{intern.duration}</span>}
              </div>
              {intern.company && <div className="lrp-entry-sub" style={{ color: config.colors.secondary }}>{intern.company}</div>}
              {intern.description && <div className="lrp-text" style={{ color: config.colors.text, marginBottom: config.spacing.line }}>{intern.description}</div>}
            </div>
          ))}
        </section>
      )
    }

    if (key === 'certifications') {
      const list = data.certifications?.filter((c) => c.name)
      if (!list?.length) return null
      return (
        <section className="lrp-section" key="certifications" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label="Certifications" icon="certifications" />
          {list.map((cert, i) => (
            <div className="lrp-bullet" key={i} style={{ color: config.colors.text, marginBottom: config.spacing.line }}>
              {config.showIcons && <span className="lrp-bullet-dot" style={{ background: config.colors.primary }} />}
              {cert.name}
            </div>
          ))}
        </section>
      )
    }

    if (key === 'achievements') {
      const list = data.achievements?.filter((a) => a.name)
      if (!list?.length) return null
      return (
        <section className="lrp-section" key="achievements" style={{ marginBottom: config.spacing.section }}>
          <SectionTitle config={config} label="Achievements" icon="achievements" />
          {list.map((ach, i) => (
            <div className="lrp-bullet" key={i} style={{ color: config.colors.text, marginBottom: config.spacing.line }}>
              {config.showIcons && <span className="lrp-bullet-dot" style={{ background: config.colors.primary }} />}
              {ach.name}
            </div>
          ))}
        </section>
      )
    }

    return null
  })
}

function PhotoBlock({ config }) {
  const { photo, photoShape, colors } = config
  if (!photo) return null
  const scale = Math.min(Math.max(config.photoScale || 1, 0.6), 1.4)
  return (
    <div className="lrp-photo" style={{ borderColor: colors.accent }}>
      <img
        src={photo}
        alt="Profile"
        style={{
          borderRadius: photoShape === 'circle' ? '50%' : '8px',
          width: `calc(80px * ${scale})`,
          height: `calc(80px * ${scale})`,
          objectFit: 'cover',
        }}
      />
    </div>
  )
}

function MobilePhoto({ config }) {
  const { photo, photoShape, colors } = config
  if (!photo) return null
  const scale = Math.min(Math.max(config.photoScale || 1, 0.6), 1.4)
  return (
    <img
      src={photo}
      alt="Profile"
      className="lrp-mobile-photo"
      style={{
        borderRadius: photoShape === 'circle' ? '50%' : '8px',
        width: `calc(72px * ${scale})`,
        height: `calc(72px * ${scale})`,
        objectFit: 'cover',
        border: `3px solid ${colors.accent}`,
      }}
    />
  )
}

function ContactRow({ config, inline }) {
  const pi = config.data.personalInfo
  const html = useMemo(() => {
    const parts = []
    const append = (icon, text) => {
      if (!text) return
      parts.push(
        <span className="lrp-contact-item" key={parts.length}>
          {config.showIcons && <Icon name={icon} />}
          {text}
        </span>
      )
    }
    append('mail', pi.email)
    append('phone', pi.phone)
    append('location', pi.location)
    append('linkedin', pi.linkedin)
    append('github', pi.github)
    append('link', pi.portfolio)
    return parts
  }, [pi, config.showIcons])

  return <div className={inline ? 'lrp-contact-row' : 'lrp-contact-col'}>{html}</div>
}

function Header({ config }) {
  const pi = config.data.personalInfo
  const style = config.headerStyle
  const colors = config.colors
  const fonts = config.fonts
  const qrPad = config.qrEnabled ? 96 : 0

  const baseStyle = {
    fontFamily: fonts.heading,
    display: 'flex',
    flexDirection: 'column',
    alignItems: style === 'center' ? 'center' : style === 'right' ? 'flex-end' : 'flex-start',
    textAlign: style === 'center' ? 'center' : style === 'right' ? 'right' : 'left',
  }

  const nameStyle = { color: colors.primary, fontSize: `calc(${fonts.size + 8}px)`, fontFamily: fonts.heading, fontWeight: 700 }

  if (style === 'banner') {
    return (
      <div className="lrp-header lrp-header-banner" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`, padding: config.spacing.padding, paddingRight: config.spacing.padding + qrPad }}>
        <div style={{ ...baseStyle, color: '#fff' }}>
          <span className="lrp-name" style={{ color: '#fff' }}>{pi.fullName || 'Your Name'}</span>
          <div className="lrp-contact-row" style={{ color: '#e2e8f0' }}>
            <ContactRow config={config} inline />
          </div>
        </div>
      </div>
    )
  }

  if (style === 'card') {
    return (
      <div className="lrp-header lrp-header-card" style={{ background: colors.background, borderLeft: `6px solid ${colors.primary}`, padding: config.spacing.padding, paddingRight: config.spacing.padding + qrPad }}>
        <div style={{ ...baseStyle, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <MobilePhoto config={config} />
          <div>
            <span className="lrp-name" style={nameStyle}>{pi.fullName || 'Your Name'}</span>
            <div className="lrp-contact-row" style={{ color: colors.secondary }}>
              <ContactRow config={config} inline />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (style === 'minimal') {
    return (
      <div className="lrp-header lrp-header-minimal" style={{ borderBottom: `2px solid ${colors.primary}`, paddingBottom: config.spacing.line + 4, paddingRight: qrPad }}>
        <div style={{ ...baseStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="lrp-name" style={nameStyle}>{pi.fullName || 'Your Name'}</span>
          <div className="lrp-contact-row" style={{ color: colors.secondary }}>
            <ContactRow config={config} inline />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lrp-header" style={{ ...baseStyle, paddingRight: qrPad }}>
      <PhotoBlock config={config} />
      <span className="lrp-name" style={nameStyle}>{pi.fullName || 'Your Name'}</span>
      <div className="lrp-contact-row" style={{ color: colors.secondary }}>
        <ContactRow config={config} inline />
      </div>
    </div>
  )
}

function normalizeLanguages(data) {
  return (data.languages || [])
    .map((lang) => (typeof lang === 'string' ? { name: lang, proficiency: '' } : lang || {}))
    .filter((l) => l.name && l.name.trim())
}

function LanguagesBlock({ config }) {
  const list = normalizeLanguages(config.data)
  if (!list.length) return null
  return (
    <section className="lrp-section" style={{ marginBottom: config.spacing.section }}>
      <SectionTitle config={config} label="Languages" icon="languages" />
      {list.map((lang, i) => (
        <div className="lrp-bullet" key={i} style={{ color: config.colors.text, marginBottom: config.spacing.line }}>
          {config.showIcons && <span className="lrp-bullet-dot" style={{ background: config.colors.primary }} />}
          <span>{lang.name}{lang.proficiency ? `  ·  ${lang.proficiency}` : ''}</span>
        </div>
      ))}
    </section>
  )
}

function TwoColumnBody({ config }) {
  const secondarySections = ['skills', 'languages']
  return (
    <div className="lrp-two-col" style={{ gap: config.spacing.padding }}>
      <div className="lrp-col">
        <SectionBlock config={{ ...config, sections: config.sections.filter((s) => !secondarySections.includes(s)) }} />
      </div>
      <div className="lrp-col">
        {!config.hiddenSections.includes('skills') && config.data.skills?.length > 0 && (
          <section className="lrp-section" style={{ marginBottom: config.spacing.section }}>
            <SectionTitle config={config} label="Skills" icon="skills" />
            <div className="lrp-skills lrp-skills-col">
              {config.data.skills.map((skill, i) => (
                <span key={i} className="lrp-skill" style={{ borderColor: config.colors.accent + '55', color: config.colors.primary, background: config.colors.background }}>
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
        {!config.hiddenSections.includes('languages') && normalizeLanguages(config.data).length > 0 && (
          <LanguagesBlock config={{ ...config, sections: ['languages'] }} />
        )}
        <SectionBlock config={{ ...config, sections: config.sections.filter((s) => secondarySections.includes(s) && !['skills', 'languages'].includes(s)) }} />
      </div>
    </div>
  )
}

function SidebarLayout({ config, side }) {
  const isLeft = side === 'left'
  const sidebarSections = config.sections.filter((s) => ['skills', 'education', 'certifications', 'languages'].includes(s))
  const mainSections = config.sections.filter((s) => !sidebarSections.includes(s))
  const hidden = config.hiddenSections

  const sidebarHas = (s) => sidebarSections.includes(s) && !hidden.includes(s)
  const mainHas = (s) => mainSections.includes(s) && !hidden.includes(s)

  return (
    <div className={`lrp-sidebar-layout ${isLeft ? 'lrp-sidebar-left' : 'lrp-sidebar-right'}`} style={{ gap: config.spacing.padding }}>
      <div className="lrp-sidebar" style={{ background: config.colors.background, padding: config.spacing.padding / 2 }}>
        {config.photo && <PhotoBlock config={config} />}
        {sidebarHas('skills') && config.data.skills?.length > 0 && (
          <section className="lrp-section" style={{ marginBottom: config.spacing.section }}>
            <SectionTitle config={config} label="Skills" icon="skills" />
            <div className="lrp-skills lrp-skills-col">
              {config.data.skills.map((skill, i) => (
                <span key={i} className="lrp-skill" style={{ borderColor: config.colors.accent + '55', color: config.colors.primary, background: '#fff' }}>
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
        {sidebarHas('languages') && normalizeLanguages(config.data).length > 0 && (
          <LanguagesBlock config={{ ...config, sections: ['languages'] }} />
        )}
        {sidebarHas('education') && config.data.education?.length > 0 && (
          <section className="lrp-section" style={{ marginBottom: config.spacing.section }}>
            <SectionTitle config={config} label="Education" icon="education" />
            {config.data.education.map((edu, i) => {
              const degree = [edu.degree, edu.department].filter(Boolean).join(' in ')
              return <div className="lrp-entry-sub" key={i} style={{ color: config.colors.text, marginBottom: config.spacing.line }}>{degree || 'Degree'}</div>
            })}
          </section>
        )}
        {sidebarHas('certifications') && config.data.certifications?.filter((c) => c.name).length > 0 && (
          <section className="lrp-section" style={{ marginBottom: config.spacing.section }}>
            <SectionTitle config={config} label="Certifications" icon="certifications" />
            {config.data.certifications.filter((c) => c.name).map((cert, i) => (
              <div className="lrp-entry-sub" key={i} style={{ color: config.colors.text, marginBottom: config.spacing.line }}>{cert.name}</div>
            ))}
          </section>
        )}
      </div>
      <div className="lrp-sidebar-main">
        <SectionBlock config={{ ...config, sections: mainSections }} />
        {mainHas('education') && config.data.education?.length > 0 && (
          <section className="lrp-section" style={{ marginBottom: config.spacing.section }}>
            <SectionTitle config={config} label="Education" icon="education" />
            {config.data.education.map((edu, i) => {
              const degree = [edu.degree, edu.department].filter(Boolean).join(' in ')
              const school = [edu.college, edu.university].filter(Boolean).join(', ')
              const years = [edu.startYear, edu.endYear].filter(Boolean).join(' - ')
              return (
                <div className="lrp-entry" key={i} style={{ marginBottom: config.spacing.line + 4 }}>
                  <div className="lrp-entry-head" style={{ fontFamily: config.fonts.heading }}>
                    <span className="lrp-entry-title">{degree || 'Degree'}</span>
                    {years && <span className="lrp-entry-date" style={{ color: config.colors.secondary }}>{years}</span>}
                  </div>
                  {school && <div className="lrp-entry-sub" style={{ color: config.colors.secondary }}>{school}</div>}
                </div>
              )
            })}
          </section>
        )}
        {mainHas('certifications') && config.data.certifications?.filter((c) => c.name).length > 0 && (
          <section className="lrp-section" style={{ marginBottom: config.spacing.section }}>
            <SectionTitle config={config} label="Certifications" icon="certifications" />
            {config.data.certifications.filter((c) => c.name).map((cert, i) => (
              <div className="lrp-bullet" key={i} style={{ color: config.colors.text, marginBottom: config.spacing.line }}>
                {config.showIcons && <span className="lrp-bullet-dot" style={{ background: config.colors.primary }} />}
                {cert.name}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function ModernGridBody({ config }) {
  return (
    <SectionBlock config={{ ...config, sections: config.sections }} />
  )
}

export default function LiveResumePreview({ config, data, resumeType, className = '', qrCodeEnabled = false, resumeId = null }) {
  const resolved = resolveConfig({ ...config, data, resumeType })
  const colors = resolved.colors
  const spacing = resolved.spacing
  const layout = resolved.layout
  const bodyStyle = {
    fontFamily: resolved.fonts.body,
    fontSize: `${resolved.fonts.size}px`,
    color: colors.text,
    padding: spacing.padding,
  }

  const renderBody = () => {
    if (layout === 'two') return <TwoColumnBody config={resolved} />
    if (layout === 'sidebar-left') return <SidebarLayout config={resolved} side="left" />
    if (layout === 'sidebar-right') return <SidebarLayout config={resolved} side="right" />
    if (layout === 'modern-grid') return <ModernGridBody config={resolved} />
    return <SectionBlock config={resolved} />
  }

  const qrUrl = qrCodeEnabled && resumeId ? resumeQrUrl(resumeId) : null
  const headerConfig = { ...resolved, qrEnabled: !!qrUrl }

  return (
    <div className={`lrp-page ${className}`} data-resume-preview="true" style={{ background: colors.background, padding: spacing.margin }}>
      {qrUrl && (
        <div className="lrp-qr-corner">
          <ResumeQRCode url={qrUrl} size={72} compact />
        </div>
      )}
      <div className="lrp-main">
        <Header config={headerConfig} />
        <div className="lrp-body" style={bodyStyle}>
          {renderBody()}
        </div>
      </div>
    </div>
  )
}
