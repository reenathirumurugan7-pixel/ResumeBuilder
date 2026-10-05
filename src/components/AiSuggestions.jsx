import { Sparkles } from 'lucide-react'
import AiAssistant from './AiAssistant'
import './AiSuggestions.css'

function AiSuggestions({ formData, resumeType, onApplyField }) {
  const isFresher = resumeType === 'fresher'

  const items = []

  const summaryText = isFresher
    ? formData?.careerObjective
    : formData?.professionalSummary
  if (summaryText && summaryText.trim()) {
    items.push({
      key: 'summary',
      label: isFresher ? 'Career Objective' : 'Professional Summary',
      text: summaryText,
      type: 'objective',
    })
  }

  const expKey = isFresher ? 'internship' : 'workExperience'
  const textKey = isFresher ? 'description' : 'responsibilities'
  const expList = Array.isArray(formData?.[expKey]) ? formData[expKey] : []
  const expText = expList
    .map((e) => (e?.[textKey] || '').trim())
    .filter(Boolean)
    .join('\n\n')
  if (expText) {
    items.push({
      key: 'experience',
      label: isFresher ? 'Internship' : 'Work Experience',
      text: expText,
      type: 'experience',
    })
  }

  const projectText = (Array.isArray(formData?.projects) ? formData.projects : [])
    .map((p) => (p?.description || '').trim())
    .filter(Boolean)
    .join('\n\n')
  if (projectText) {
    items.push({
      key: 'projects',
      label: 'Projects',
      text: projectText,
      type: 'projects',
    })
  }

  const skillsText = (Array.isArray(formData?.skills) ? formData.skills : []).join(', ')
  if (skillsText.trim()) {
    items.push({
      key: 'skills',
      label: 'Skills',
      text: skillsText,
      type: 'skills',
    })
  }

  if (items.length === 0) {
    return (
      <div className="ai-suggestions">
        <div className="ai-suggestions-head">
          <Sparkles size={15} />
          Quick AI Enhancements
        </div>
        <p className="ai-suggestions-empty">
          Fill in your resume details first, then use these shortcuts to improve each section.
        </p>
      </div>
    )
  }

  const applySection = (key, result) => {
    const fd = JSON.parse(JSON.stringify(formData))
    if (key === 'summary') {
      if (isFresher) fd.careerObjective = result
      else fd.professionalSummary = result
    } else if (key === 'skills') {
      fd.skills = result.split(',').map((s) => s.trim()).filter(Boolean)
    } else if (key === 'projects') {
      const prog = result.split(/\n{2,}/)
      fd.projects = (fd.projects || []).map((p, i) => ({
        ...p,
        description: prog[i] ? prog[i].trim() : p.description,
      }))
    } else if (key === 'experience') {
      const blocks = result.split(/\n{2,}/)
      const textKey = isFresher ? 'description' : 'responsibilities'
      fd[isFresher ? 'internship' : 'workExperience'] = (fd[isFresher ? 'internship' : 'workExperience'] || []).map((e, i) => ({
        ...e,
        [textKey]: blocks[i] ? blocks[i].trim() : e[textKey],
      }))
    }
    onApplyField(fd)
  }

  return (
    <div className="ai-suggestions">
      <div className="ai-suggestions-head">
        <Sparkles size={15} />
        Quick AI Enhancements
      </div>
      <p className="ai-suggestions-note">
        Choose a section to generate an improved version.
      </p>
      {items.map((item) => (
        <div className="ai-suggest-item" key={item.key}>
          <span className="ai-suggest-item-label">{item.label}</span>
          <AiAssistant
            text={item.text}
            type={item.type}
            label="Improve with AI"
            onApply={(result) => applySection(item.key, result)}
          />
        </div>
      ))}
    </div>
  )
}

export default AiSuggestions
