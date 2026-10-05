import templates from '../data/templates'

export const colorPresets = [
  { id: 'blue', label: 'Blue', colors: { primary: '#2563EB', secondary: '#1E40AF', accent: '#60A5FA', background: '#EFF6FF', text: '#1E293B' } },
  { id: 'green', label: 'Green', colors: { primary: '#16A34A', secondary: '#15803D', accent: '#4ADE80', background: '#F0FDF4', text: '#1E293B' } },
  { id: 'purple', label: 'Purple', colors: { primary: '#7C3AED', secondary: '#6D28D9', accent: '#A78BFA', background: '#FAF5FF', text: '#1E293B' } },
  { id: 'red', label: 'Red', colors: { primary: '#DC2626', secondary: '#B91C1C', accent: '#F87171', background: '#FEF2F2', text: '#1E293B' } },
  { id: 'orange', label: 'Orange', colors: { primary: '#EA580C', secondary: '#C2410C', accent: '#FB923C', background: '#FFF7ED', text: '#1E293B' } },
  { id: 'black', label: 'Black', colors: { primary: '#111827', secondary: '#000000', accent: '#6B7280', background: '#FFFFFF', text: '#111827' } },
  { id: 'gray', label: 'Gray', colors: { primary: '#4B5563', secondary: '#374151', accent: '#9CA3AF', background: '#F9FAFB', text: '#1F2937' } },
  { id: 'navy', label: 'Navy', colors: { primary: '#0B1F3A', secondary: '#102A43', accent: '#2563EB', background: '#EEF2F7', text: '#0F172A' } },
  { id: 'teal', label: 'Teal', colors: { primary: '#0D9488', secondary: '#0F766E', accent: '#5EEAD4', background: '#F0FDFA', text: '#1E293B' } },
  { id: 'pink', label: 'Pink', colors: { primary: '#DB2777', secondary: '#BE185D', accent: '#F9A8D4', background: '#FDF2F8', text: '#1E293B' } },
]

export const fontOptions = [
  { id: 'Roboto', label: 'Roboto' },
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Inter', label: 'Inter' },
  { id: 'Open Sans', label: 'Open Sans' },
  { id: 'Lato', label: 'Lato' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Nunito', label: 'Nunito' },
  { id: 'Merriweather', label: 'Merriweather' },
  { id: 'Georgia', label: 'Georgia' },
  { id: 'Times New Roman', label: 'Times New Roman' },
]

export const layoutOptions = [
  { id: 'single', label: 'Single Column' },
  { id: 'two', label: 'Two Column' },
  { id: 'sidebar-left', label: 'Sidebar Left' },
  { id: 'sidebar-right', label: 'Sidebar Right' },
  { id: 'modern-grid', label: 'Modern Grid' },
  { id: 'executive', label: 'Executive Layout' },
  { id: 'minimal', label: 'Minimal Layout' },
  { id: 'creative', label: 'Creative Layout' },
]

export const headerOptions = [
  { id: 'center', label: 'Center' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'banner', label: 'Banner' },
  { id: 'card', label: 'Card Style' },
  { id: 'minimal', label: 'Minimal' },
]

export const allSectionKeys = [
  'summary',
  'education',
  'skills',
  'languages',
  'projects',
  'experience',
  'internship',
  'certifications',
  'achievements',
]

export const sectionLabels = {
  summary: 'Summary / Career Objective',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  projects: 'Projects',
  experience: 'Experience',
  internship: 'Internship',
  certifications: 'Certifications',
  achievements: 'Achievements',
}

export const profilePhotoSections = ['education', 'skills', 'projects', 'experience', 'internship', 'certifications', 'achievements']

export const defaultSections = [
  'summary',
  'education',
  'skills',
  'languages',
  'projects',
  'experience',
  'internship',
  'certifications',
  'achievements',
]

export function templateDefaultConfig(template) {
  const c = template.colorTheme
  return {
    templateId: template.id,
    name: template.name,
    isCustom: false,
    colors: {
      primary: c.primary,
      secondary: c.secondary,
      accent: c.accent,
      background: c.bg,
      text: c.text,
    },
    fonts: { heading: 'Poppins', body: 'Inter', size: 14 },
    layout: template.layout || 'single',
    headerStyle: (template.previewStyle && template.previewStyle.headerAlign) || 'center',
    sections: [...defaultSections],
    hiddenSections: [],
    showIcons: true,
    photo: null,
    photoShape: 'circle',
    photoScale: 1,
    spacing: { margin: 32, padding: 28, section: 16, line: 4 },
  }
}

export function findTemplate(id) {
  return templates.find((t) => t.id === id) || null
}

export function resolveConfig(config) {
  const template = findTemplate(config.templateId) || templates[0]
  const base = templateDefaultConfig(template)
  const sections = Array.isArray(config.sections) && config.sections.length ? [...config.sections] : [...base.sections]
  if (!sections.includes('languages')) {
    const skillsIndex = sections.indexOf('skills')
    sections.splice(skillsIndex === -1 ? Math.min(1, sections.length) : skillsIndex + 1, 0, 'languages')
  }
  return {
    ...base,
    ...config,
    colors: { ...base.colors, ...(config.colors || {}) },
    fonts: { ...base.fonts, ...(config.fonts || {}) },
    spacing: { ...base.spacing, ...(config.spacing || {}) },
    sections,
    hiddenSections: Array.isArray(config.hiddenSections) ? config.hiddenSections : [],
  }
}
