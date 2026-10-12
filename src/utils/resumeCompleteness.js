// Resume Completeness scoring.
//
// Unlike the ATS score, which grades the *quality* of the content, this measures
// whether each section the user can actually fill in this editor is meaningfully
// present. It never inspects the value of the text — just that there is some.
//
// The section list is derived per resume type so a fresher is never penalised
// for lacking full-time work: the experience slot maps to Internship for a
// fresher and Work Experience for a professional. Every defined section counts
// equally towards the percentage, and any field a type does not expose stays out
// of the denominator so optional sections cannot drag the score down unfairly.

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function asEntry(value) {
  return isObject(value) ? value : {}
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasString(value) {
  return hasText(value == null ? '' : String(value))
}

function hasPersonalInfo(formData) {
  const pi = asEntry(formData.personalInfo)
  return hasText(pi.fullName) && hasText(pi.email) && hasText(pi.phone)
}

function hasSummary(formData, resumeType) {
  return resumeType === 'experienced'
    ? hasText(formData.professionalSummary)
    : hasText(formData.careerObjective)
}

function hasEducation(formData) {
  return asList(formData.education).some((edu) => {
    const entry = asEntry(edu)
    return hasText(entry.degree) || hasText(entry.college) || hasText(entry.university)
  })
}

function hasSkills(formData) {
  return asList(formData.skills).some((skill) => hasString(skill))
}

function hasProjects(formData) {
  return asList(formData.projects).some((proj) => {
    const entry = asEntry(proj)
    return hasText(entry.title) || hasText(entry.description) || hasText(entry.technologies) || hasText(entry.link)
  })
}

function hasInternship(formData) {
  return asList(formData.internship).some((intern) => {
    const entry = asEntry(intern)
    return hasText(entry.role) || hasText(entry.company) || hasText(entry.duration) || hasText(entry.description)
  })
}

function hasExperience(formData) {
  return asList(formData.workExperience).some((exp) => {
    const entry = asEntry(exp)
    return hasText(entry.jobTitle) || hasText(entry.company) || hasText(entry.responsibilities)
  })
}

function hasNamedEntry(list) {
  return asList(list).some((item) => hasText(asEntry(item).name))
}

function hasLinks(formData) {
  const pi = asEntry(formData.personalInfo)
  return hasText(pi.linkedin) || hasText(pi.github) || hasText(pi.portfolio)
}

const SECTION_CHECKS = {
  personal: hasPersonalInfo,
  summary: hasSummary,
  education: hasEducation,
  skills: hasSkills,
  projects: hasProjects,
  internship: hasInternship,
  experience: hasExperience,
  certifications: (fd) => hasNamedEntry(fd.certifications),
  achievements: (fd) => hasNamedEntry(fd.achievements),
  links: hasLinks,
}

function defineSections(resumeType) {
  const isFresher = resumeType === 'fresher'
  return [
    { key: 'personal', label: 'Personal Information', check: 'personal' },
    { key: 'summary', label: isFresher ? 'Career Objective' : 'Professional Summary', check: 'summary' },
    { key: 'education', label: 'Education', check: 'education' },
    { key: 'skills', label: 'Skills', check: 'skills' },
    { key: 'projects', label: 'Projects', check: 'projects' },
    { key: isFresher ? 'internship' : 'experience', label: isFresher ? 'Internship' : 'Work Experience', check: isFresher ? 'internship' : 'experience' },
    { key: 'certifications', label: 'Certifications', check: 'certifications' },
    { key: 'achievements', label: 'Achievements', check: 'achievements' },
    { key: 'links', label: 'LinkedIn / GitHub', check: 'links' },
  ]
}

export function calculateResumeCompleteness(formData, resumeType) {
  const fd = asEntry(formData)
  const type = resumeType === 'fresher' ? 'fresher' : 'experienced'

  const sections = defineSections(type).map(({ key, label, check }) => ({
    key,
    label,
    complete: Boolean(SECTION_CHECKS[check](fd, type)),
  }))

  const completed = sections.filter((s) => s.complete).length
  const total = sections.length

  return {
    score: total > 0 ? Math.round((completed / total) * 100) : 0,
    completed,
    incomplete: total - completed,
    total,
    sections,
  }
}