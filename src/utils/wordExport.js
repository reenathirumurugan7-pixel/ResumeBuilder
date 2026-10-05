import templates from '../data/templates'
import { resolveConfig } from '../config/customize'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
} from 'docx'

function normalizeConfig(configOrId) {
  if (configOrId && typeof configOrId === 'object') {
    return resolveConfig(configOrId)
  }
  if (configOrId) {
    const template = templates.find((t) => t.id === configOrId)
    if (template) return resolveConfig({ templateId: template.id })
  }
  return null
}

function toBytesDataUrl(dataUrl) {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    base64: match[2],
  }
}



function addSectionHeading(children, title, accent) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          color: accent.replace('#', ''),
        }),
      ],
    }),
  )
}

function addPlainText(children, text, size = 20) {
  if (!text) return
  children.push(
    new Paragraph({
      children: [new TextRun({ text, size })],
      spacing: { after: 120 },
    }),
  )
}

function addBulletText(children, text, size = 20) {
  if (!text) return
  children.push(
    new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun({ text, size })],
      spacing: { after: 60 },
    }),
  )
}

export async function generateWord(formData, resumeType, configOrId = null) {
  const pi = formData.personalInfo || {}
  const config = normalizeConfig(configOrId) || resolveConfig({ templateId: 'modern-blue' })
  const accent = config.colors.primary
  const children = []

  const photoData = toBytesDataUrl(config.photo || pi.photo)
  if (photoData) {
    try {
      const byteString = atob(photoData.base64)
      const byteArray = new Uint8Array(byteString.length)
      for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i)
      }
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new ImageRun({
              data: byteArray,
              transformation: { width: 90, height: 90 },
            }),
          ],
        }),
      )
    } catch {
      // ignore
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: pi.fullName || 'Your Name', bold: true, size: 36 })],
      spacing: { after: 60 },
    }),
  )
  const contactLine = [pi.email, pi.phone, pi.location].filter(Boolean).join(' | ')
  const linkLine = [pi.linkedin, pi.github, pi.portfolio].filter(Boolean).join(' | ')
  if (contactLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contactLine, size: 20 })],
        spacing: { after: 30 },
      }),
    )
  }
  if (linkLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: linkLine, size: 18 })],
        spacing: { after: 240 },
      }),
    )
  }

  const hidden = config.hiddenSections || []
  const orderedSections = (config.sections || []).filter((s) => !hidden.includes(s))
  const push = (key, fn) => {
    if (!orderedSections.includes(key)) return
    fn()
  }

  push('summary', () => {
    if (resumeType === 'fresher' && formData.careerObjective) {
      addSectionHeading(children, 'Career Objective', accent)
      addPlainText(children, formData.careerObjective)
    } else if (resumeType === 'experienced' && formData.professionalSummary) {
      addSectionHeading(children, 'Professional Summary', accent)
      addPlainText(children, formData.professionalSummary)
    }
  })

  push('experience', () => {
    if (resumeType === 'experienced' && formData.workExperience?.length > 0) {
      addSectionHeading(children, 'Work Experience', accent)
      formData.workExperience.forEach((exp) => {
        const title = exp.jobTitle || 'Job Title'
        const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ')
        const company = [exp.company, exp.location].filter(Boolean).join(', ')
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: title, bold: true, size: 22 }),
              dates
                ? new TextRun({ text: `   ${dates}`, size: 20 })
                : new TextRun({ text: '', size: 20 }),
            ],
            spacing: { before: 60, after: 30 },
          }),
        )
        if (company) {
          addPlainText(children, company)
        }
        if (exp.responsibilities) {
          addPlainText(children, exp.responsibilities)
        }
      })
    }
  })

  push('education', () => {
    if (formData.education?.length > 0) {
      addSectionHeading(children, 'Education', accent)
      formData.education.forEach((edu) => {
        const degree = [edu.degree, edu.department].filter(Boolean).join(' in ')
        const years = [edu.startYear, edu.endYear].filter(Boolean).join(' - ')
        const school = [edu.college, edu.university].filter(Boolean).join(', ')
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: degree || 'Degree', bold: true, size: 22 }),
              years ? new TextRun({ text: `   ${years}`, size: 20 }) : new TextRun({ text: '', size: 20 }),
            ],
            spacing: { before: 60, after: 30 },
          }),
        )
        if (school) addPlainText(children, school)
        if (edu.cgpa) {
          const cgpaLabel = String(edu.cgpa).trim().endsWith('%') ? 'Percentage' : 'CGPA'
          addPlainText(children, `${cgpaLabel}: ${edu.cgpa}`)
        }
      })
    }
  })

  push('skills', () => {
    if (formData.skills?.length > 0) {
      addSectionHeading(children, 'Skills', accent)
      addPlainText(children, formData.skills.join('   •   '))
    }
  })

  push('languages', () => {
    const languages = (formData.languages || [])
      .map((lang) => (typeof lang === 'string' ? { name: lang, proficiency: '' } : lang || {}))
      .filter((lang) => lang.name && lang.name.trim())
    if (languages.length > 0) {
      addSectionHeading(children, 'Languages', accent)
      languages.forEach((lang) => {
        const label = lang.proficiency ? `${lang.name} (${lang.proficiency})` : lang.name
        addBulletText(children, label)
      })
    }
  })

  push('projects', () => {
    if (formData.projects?.length > 0) {
      addSectionHeading(children, 'Projects', accent)
      formData.projects.forEach((proj) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: proj.title || 'Project', bold: true, size: 22 })],
            spacing: { before: 60, after: 30 },
          }),
        )
        if (proj.technologies) {
          addPlainText(children, `Technologies: ${proj.technologies}`)
        }
        if (proj.description) addPlainText(children, proj.description)
        if (proj.link) addPlainText(children, proj.link)
      })
    }
  })

  push('internship', () => {
    const internships = resumeType === 'fresher' ? formData.internship : null
    if (internships?.length > 0) {
      addSectionHeading(children, 'Internship', accent)
      internships.forEach((intern) => {
        const role = intern.role || 'Role'
        const dur = intern.duration || ''
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: role, bold: true, size: 22 }),
              dur ? new TextRun({ text: `   ${dur}`, size: 20 }) : new TextRun({ text: '', size: 20 }),
            ],
            spacing: { before: 60, after: 30 },
          }),
        )
        if (intern.company) addPlainText(children, intern.company)
        if (intern.description) addPlainText(children, intern.description)
      })
    }
  })

  push('certifications', () => {
    if (formData.certifications?.length > 0) {
      addSectionHeading(children, 'Certifications', accent)
      formData.certifications.forEach((cert) => {
        if (cert.name) addBulletText(children, cert.name)
      })
    }
  })

  push('achievements', () => {
    if (formData.achievements?.length > 0) {
      addSectionHeading(children, 'Achievements', accent)
      formData.achievements.forEach((ach) => {
        if (ach.name) addBulletText(children, ach.name)
      })
    }
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const safeName = (pi.fullName || 'resume')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'resume'
  const fileName = `${safeName}_Resume.docx`
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  // Resolved once the browser has been handed the file, so callers can confirm
  // the download happened before they count it.
  return fileName
}
