export function printResume(formData, resumeType) {
  const pi = formData.personalInfo

  const contactLine = [pi.email, pi.phone, pi.location].filter(Boolean).join(' | ')
  const linkLine = [pi.linkedin, pi.github, pi.portfolio].filter(Boolean).join(' | ')

  let sections = []

  sections.push(`<h1 style="text-align:center;margin-bottom:4px;">${pi.fullName || 'Your Name'}</h1>`)
  if (contactLine) {
    sections.push(`<p style="text-align:center;color:#64748b;font-size:10pt;margin:2px 0;">${contactLine}</p>`)
  }
  if (linkLine) {
    sections.push(`<p style="text-align:center;color:#64748b;font-size:9pt;margin:2px 0;">${linkLine}</p>`)
  }
  sections.push('<hr style="border:none;border-top:2px solid #1a56db;margin:12px 0;"/>')

  if (resumeType === 'fresher' && formData.careerObjective) {
    sections.push(ps('Career Objective', `<p>${formData.careerObjective}</p>`))
  }

  if (resumeType === 'experienced' && formData.professionalSummary) {
    sections.push(ps('Professional Summary', `<p>${formData.professionalSummary}</p>`))
  }

  if (resumeType === 'experienced' && formData.workExperience?.length > 0) {
    let h = ''
    formData.workExperience.forEach((exp) => {
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ')
      h += `<div style="margin-bottom:8px;">`
      h += `<p><strong>${exp.jobTitle || 'Job Title'}</strong> <span style="color:#64748b;float:right;">${dates}</span></p>`
      if (exp.company) h += `<p style="color:#475569;">${exp.company}${exp.location ? `, ${exp.location}` : ''}</p>`
      if (exp.responsibilities) h += `<p>${exp.responsibilities}</p>`
      h += `</div>`
    })
    sections.push(ps('Work Experience', h))
  }

  if (formData.education?.length > 0) {
    let h = ''
    formData.education.forEach((edu) => {
      const degree = [edu.degree, edu.department].filter(Boolean).join(' in ')
      const years = [edu.startYear, edu.endYear].filter(Boolean).join(' - ')
      const school = [edu.college, edu.university].filter(Boolean).join(', ')
      h += `<div style="margin-bottom:8px;">`
      h += `<p><strong>${degree || 'Degree'}</strong> <span style="color:#64748b;float:right;">${years}</span></p>`
      if (school) h += `<p style="color:#475569;">${school}</p>`
      if (edu.cgpa) h += `<p style="color:#475569;">${String(edu.cgpa).trim().endsWith('%') ? 'Percentage' : 'CGPA'}: ${edu.cgpa}</p>`
      h += `</div>`
    })
    sections.push(ps('Education', h))
  }

  if (formData.skills?.length > 0) {
    sections.push(ps('Skills', `<p>${formData.skills.join(' • ')}</p>`))
  }

  const languages = (formData.languages || [])
    .map((lang) => (typeof lang === 'string' ? { name: lang, proficiency: '' } : lang || {}))
    .filter((lang) => lang.name && lang.name.trim())
  if (languages.length > 0) {
    let h = '<ul style="margin:0;padding-left:20px;">'
    languages.forEach((lang) => {
      h += `<li style="margin-bottom:3px;">${lang.name}${lang.proficiency ? ` (${lang.proficiency})` : ''}</li>`
    })
    h += '</ul>'
    sections.push(ps('Languages', h))
  }

  if (formData.projects?.length > 0) {
    let h = ''
    formData.projects.forEach((proj) => {
      h += `<div style="margin-bottom:8px;">`
      h += `<p><strong>${proj.title || 'Project'}</strong></p>`
      if (proj.technologies) h += `<p style="color:#64748b;font-style:italic;">Technologies: ${proj.technologies}</p>`
      if (proj.description) h += `<p>${proj.description}</p>`
      if (proj.link) h += `<p style="color:#1a56db;font-size:9pt;">${proj.link}</p>`
      h += `</div>`
    })
    sections.push(ps('Projects', h))
  }

  const internships = resumeType === 'fresher' ? formData.internship : null
  if (internships?.length > 0) {
    let h = ''
    internships.forEach((intern) => {
      h += `<div style="margin-bottom:8px;">`
      h += `<p><strong>${intern.role || 'Role'}</strong> <span style="color:#64748b;float:right;">${intern.duration || ''}</span></p>`
      if (intern.company) h += `<p style="color:#475569;">${intern.company}</p>`
      if (intern.description) h += `<p>${intern.description}</p>`
      h += `</div>`
    })
    sections.push(ps('Internship', h))
  }

  if (formData.certifications?.length > 0) {
    let h = '<ul style="margin:0;padding-left:20px;">'
    formData.certifications.forEach((cert) => {
      if (cert.name) h += `<li style="margin-bottom:3px;">${cert.name}</li>`
    })
    h += '</ul>'
    sections.push(ps('Certifications', h))
  }

  if (formData.achievements?.length > 0) {
    let h = '<ul style="margin:0;padding-left:20px;">'
    formData.achievements.forEach((ach) => {
      if (ach.name) h += `<li style="margin-bottom:3px;">${ach.name}</li>`
    })
    h += '</ul>'
    sections.push(ps('Achievements', h))
  }

  const printWindow = window.open('', '_blank')
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${pi.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Calibri, Arial, sans-serif; padding: 30px 40px; color: #1e293b; line-height: 1.5; }
    h1 { font-size: 18pt; }
    h2 { color: #1a56db; font-size: 11pt; border-bottom: 1px solid #dbeafe; padding-bottom: 3px; margin-top: 14px; margin-bottom: 6px; }
    p { font-size: 10pt; margin-bottom: 2px; }
    @media print { body { padding: 20px 30px; } }
  </style>
</head>
<body>
  ${sections.join('\n')}
</body>
</html>`)
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
  }, 500)
}

function ps(title, content) {
  return `<h2>${title}</h2>\n${content}`
}
