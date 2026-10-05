import { calculateAtsScore, TECHNICAL_KEYWORDS } from './atsScore'

export function safeText(val) {
  return val == null ? '' : String(val)
}

export function capFirst(str) {
  const s = safeText(str).trim()
  return /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export const TYPO_MAP = {
  teh: 'the',
  recieve: 'receive',
  recieved: 'received',
  seperate: 'separate',
  seperated: 'separated',
  occured: 'occurred',
  occuring: 'occurring',
  definately: 'definitely',
  adress: 'address',
  buisness: 'business',
  experiance: 'experience',
  liscence: 'license',
  maintanance: 'maintenance',
  acheive: 'achieve',
  acheived: 'achieved',
  untill: 'until',
  begining: 'beginning',
  enviroment: 'environment',
  goverment: 'government',
  commited: 'committed',
  developped: 'developed',
  existance: 'existence',
  succesful: 'successful',
  successfull: 'successful',
  writting: 'writing',
  alot: 'a lot',
  dont: "don't",
  cant: "can't",
  wont: "won't",
  ive: "I've",
  im: "I'm",
  isnt: "isn't",
  didnt: "didn't",
  doesnt: "doesn't",
  wasnt: "wasn't",
  arent: "aren't",
  werent: "weren't",
  youre: "you're",
  theyre: "they're",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
}

const WEAK_PHRASES = [
  { re: /^(?:i am a|i'm a|i am|i'm)\s+/i, to: '', reason: 'Remove first-person phrasing for a stronger resume' },
  { re: /\bin order to\b/gi, to: 'to', reason: 'Shorten verbose phrasing' },
  { re: /\band also\b/gi, to: 'and', reason: 'Remove redundant phrasing' },
  { re: /\bvery good\b/gi, to: 'strong', reason: 'Replace weak modifier with a sharper word' },
  { re: /\breally good\b/gi, to: 'strong', reason: 'Replace weak modifier with a sharper word' },
]

const GERUND_VERB_MAP = {
  developing: 'developed',
  designing: 'designed',
  implementing: 'implemented',
  managing: 'managed',
  creating: 'created',
  building: 'built',
  leading: 'led',
  coordinating: 'coordinated',
  organizing: 'organized',
  launching: 'launched',
  optimizing: 'optimized',
  improving: 'improved',
  testing: 'tested',
  analyzing: 'analyzed',
  researching: 'researched',
  writing: 'wrote',
  documenting: 'documented',
  maintaining: 'maintained',
  integrating: 'integrated',
  automating: 'automated',
  delivering: 'delivered',
  planning: 'planned',
  supporting: 'supported',
  training: 'trained',
  mentoring: 'mentored',
  supervising: 'supervised',
  deploying: 'deployed',
  migrating: 'migrated',
  handling: 'handled',
}

function hasTypo(text) {
  return Object.keys(TYPO_MAP).some((from) => new RegExp(`\\b${from}\\b`, 'i').test(text))
}

export function checkGrammar(text) {
  const issues = []
  const t = safeText(text).trim()
  if (!t) return issues

  const capCount = (t.match(/(^|[.!?]\s+)([a-z])/g) || []).length
  if (capCount) {
    issues.push({ type: 'capitalize', count: capCount, message: `Capitalize ${capCount} sentence start${capCount > 1 ? 's' : ''}` })
  }

  const reps = (t.match(/\b([a-zA-Z']+)\s+\1\b/gi) || []).filter(Boolean)
  if (reps.length) {
    const shown = [...new Set(reps.map((r) => r.toLowerCase()))].slice(0, 3).join(', ')
    issues.push({ type: 'repeated-word', count: reps.length, message: `Repeated word${reps.length > 1 ? 's' : ''} found (${shown})` })
  }

  const spaceCount = (t.match(/ {2,}/g) || []).length
  if (spaceCount) {
    issues.push({ type: 'spacing', count: spaceCount, message: 'Remove extra spaces' })
  }

  if (hasTypo(t)) {
    const hits = Object.keys(TYPO_MAP).filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(t)).slice(0, 4)
    issues.push({ type: 'typo', count: hits.length, message: `Possible misspelling${hits.length > 1 ? 's' : ''}: ${hits.map((h) => `"${h}"`).join(', ')}` })
  }

  if (/[a-zA-Z0-9)\]"]$/.test(t)) {
    issues.push({ type: 'period', count: 1, message: 'Add a closing period' })
  }

  return issues
}

export function enhanceText(text) {
  let t = safeText(text).trim()
  const changes = []
  if (!t) return { text: t, changes }

  Object.entries(TYPO_MAP).forEach(([from, to]) => {
    const rx = new RegExp(`\\b${from}\\b`, 'gi')
    if (rx.test(t)) {
      const before = t
      t = t.replace(rx, to)
      changes.push({ before, after: t, reason: `Correct "${from}" to "${to}"` })
    }
  })

  WEAK_PHRASES.forEach(({ re, to, reason }) => {
    if (re.test(t)) {
      const before = t
      t = t.replace(re, to)
      changes.push({ before, after: t, reason })
    }
  })

  const capped = capFirst(t)
  if (capped !== t && !/^[A-Z]/.test(t.charAt(0))) {
    changes.push({ before: t, after: capped, reason: 'Capitalize the start of the sentence' })
    t = capped
  }

  if (/ {2,}/.test(t)) {
    const before = t
    t = t.replace(/ {2,}/g, ' ').trim()
    changes.push({ before, after: t, reason: 'Remove extra spaces' })
  }

  if (!/[.!?]["')]$/.test(t)) {
    const before = t
    t = `${t}.`
    changes.push({ before, after: t, reason: 'End the sentence with a period' })
  }

  return { text: t, changes }
}

export function enhanceBullet(bullet) {
  const original = safeText(bullet).trim()
  if (!original) return { enhanced: '', changes: [], hasData: false }

  let t = original
  const changes = []
  const gerundList = Object.keys(GERUND_VERB_MAP).join('|')
  const gerundRx = new RegExp(`^(${gerundList})\\b`, 'i')

  const lead = t.match(gerundRx)
  if (lead) {
    const rest = t.slice(lead[0].length).trim()
    if (rest && !/^and\s|^or\s/i.test(rest)) {
      const before = t
      t = capFirst(`${GERUND_VERB_MAP[lead[1].toLowerCase()]} ${rest}`)
      changes.push({ before, after: t, reason: 'Use a past-tense action verb instead of a present participle' })
    }
  }

  const resp = t.match(new RegExp(`^responsible for\\s+(?:the\\s+)?(${gerundList})\\b`, 'i'))
  if (resp) {
    const before = t
    const verb = capFirst(GERUND_VERB_MAP[resp[1].toLowerCase()])
    const rest = t.slice(resp[0].length).replace(/^[.,:\s]+/, '')
    t = rest ? `${verb} ${capFirst(rest)}` : verb
    changes.push({ before, after: t, reason: 'Replace passive "responsible for" with a strong action verb' })
  }

  const worked = t.match(new RegExp(`^worked on\\s+(?:the\\s+)?(${gerundList})\\b`, 'i'))
  if (worked) {
    const before = t
    const verb = capFirst(GERUND_VERB_MAP[worked[1].toLowerCase()])
    const rest = t.slice(worked[0].length).replace(/^[.,:\s]+/, '')
    t = rest ? `${verb} ${capFirst(rest)}` : verb
    changes.push({ before, after: t, reason: 'Replace weak "worked on" with a strong action verb' })
  }

  if (/^(responsible for|worked on|was responsible|was in charge|my role was)\b/i.test(t)) {
    changes.push({
      before: t,
      after: t,
      manual: true,
      reason: 'Replace this passive opener with a specific action verb (e.g. "Developed", "Led", "Built")',
    })
  }

  const tex = enhanceText(t)
  if (tex.text !== t) {
    changes.push({ before: t, after: tex.text, reason: 'Fix spelling, capitalization, spacing and punctuation' })
    t = tex.text
  }

  return { enhanced: t, original, changes, hasData: true }
}

export function enhanceSummary(formData, resumeType) {
  const key = resumeType === 'fresher' ? 'careerObjective' : 'professionalSummary'
  const original = safeText(formData[key])
  if (!original.trim()) return { key, original, enhanced: original, changes: [], hasData: false }
  const res = enhanceText(original)
  return { key, original, enhanced: res.text, changes: res.changes, hasData: true }
}

export function enhanceSkills(skills) {
  const original = (Array.isArray(skills) ? skills : []).map((s) => safeText(s).trim()).filter(Boolean)
  const enhanced = []
  const removed = []
  const seen = new Set()
  original.forEach((skill) => {
    const lower = skill.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      enhanced.push(skill)
    } else {
      removed.push(skill)
    }
  })
  const changes = removed.length
    ? [{ before: removed.join(', '), after: '(removed duplicate)', reason: `Remove ${removed.length} duplicate skill${removed.length > 1 ? 's' : ''}` }]
    : []
  return { original, enhanced, changes, hasData: original.length > 0 }
}

export function enhanceProjects(projects) {
  const list = (Array.isArray(projects) ? projects : []).map((p) => ({ ...p }))
  const enhanced = clone(list)
  const changes = []
  let changedCount = 0

  list.forEach((proj, index) => {
    const title = safeText(proj.title).trim() || `Project ${index + 1}`
    const text = safeText(proj.description)
    if (!text.trim()) return
    const res = enhanceBullet(text)
    if (res.enhanced !== text) {
      enhanced[index] = { ...enhanced[index], description: res.enhanced }
      changedCount += 1
      res.changes.forEach((c) => changes.push({ ...c, section: title }))
    }
  })

  return { original: list, enhanced, changes, hasData: list.length > 0, changedCount }
}

export function enhanceExperience(entries, resumeType) {
  const list = (Array.isArray(entries) ? entries : []).map((e) => ({ ...e }))
  const enhanced = clone(list)
  const changes = []
  const textKey = resumeType === 'fresher' ? 'description' : 'responsibilities'
  let changedCount = 0

  list.forEach((entry, index) => {
    const title = [safeText(entry.jobTitle), entry.role, entry.company]
      .map((v) => safeText(v).trim())
      .filter(Boolean)
      .join(' — ') || `${resumeType === 'fresher' ? 'Internship' : 'Experience'} ${index + 1}`
    const text = safeText(entry[textKey])
    if (!text.trim()) return
    const res = enhanceBullet(text)
    if (res.enhanced !== text) {
      enhanced[index] = { ...enhanced[index], [textKey]: res.enhanced }
      changedCount += 1
      res.changes.forEach((c) => changes.push({ ...c, section: title }))
    }
  })

  return { original: list, enhanced, changes, hasData: list.length > 0, changedCount }
}

function flattenText(formData) {
  const fd = formData || {}
  return [
    safeText(fd.personalInfo && fd.personalInfo.fullName),
    safeText(fd.careerObjective),
    safeText(fd.professionalSummary),
    ...(Array.isArray(fd.education) ? fd.education.map((e) => `${safeText(e.degree)} ${safeText(e.department)} ${safeText(e.college)} ${safeText(e.university)}`) : []),
    ...(Array.isArray(fd.skills) ? fd.skills : []),
    ...(Array.isArray(fd.languages) ? fd.languages.map((l) => (typeof l === 'string' ? l : safeText(l.name))) : []),
    ...(Array.isArray(fd.projects) ? fd.projects.map((p) => `${safeText(p.title)} ${safeText(p.description)} ${safeText(p.technologies)}`) : []),
    ...(Array.isArray(fd.internship) ? fd.internship.map((e) => `${safeText(e.role)} ${safeText(e.company)} ${safeText(e.description)}`) : []),
    ...(Array.isArray(fd.workExperience) ? fd.workExperience.map((e) => `${safeText(e.jobTitle)} ${safeText(e.company)} ${safeText(e.responsibilities)}`) : []),
    ...(Array.isArray(fd.certifications) ? fd.certifications.map((c) => safeText(c.name)) : []),
    ...(Array.isArray(fd.achievements) ? fd.achievements.map((a) => safeText(a.name)) : []),
  ].join(' ')
}

export function missingTechnicalKeywords(formData) {
  const haystack = flattenText(formData).toLowerCase()
  return TECHNICAL_KEYWORDS.filter((kw) => !haystack.includes(kw.toLowerCase()))
}

function collectTextSections(formData, resumeType) {
  const sections = []
  const summaryKey = resumeType === 'fresher' ? 'careerObjective' : 'professionalSummary'
  const summaryLabel = resumeType === 'fresher' ? 'Career Objective' : 'Professional Summary'
  if (safeText(formData[summaryKey]).trim()) sections.push({ label: summaryLabel, text: formData[summaryKey] })

  ;(Array.isArray(formData.projects) ? formData.projects : []).forEach((p, i) => {
    if (safeText(p.description).trim()) sections.push({ label: safeText(p.title).trim() || `Project ${i + 1}`, text: p.description })
  })

  const expList = resumeType === 'fresher'
    ? (Array.isArray(formData.internship) ? formData.internship : [])
    : (Array.isArray(formData.workExperience) ? formData.workExperience : [])
  expList.forEach((entry, i) => {
    const textKey = resumeType === 'fresher' ? 'description' : 'responsibilities'
    const name = [safeText(entry.jobTitle), entry.role, entry.company].map((v) => safeText(v).trim()).filter(Boolean).join(' — ')
    if (safeText(entry[textKey]).trim()) sections.push({ label: name || `${resumeType === 'fresher' ? 'Internship' : 'Experience'} ${i + 1}`, text: entry[textKey] })
  })

  return sections
}

export function applyTextFixes(formData, resumeType) {
  const fd = clone(formData || {})
  const applied = []

  const summaryKey = resumeType === 'fresher' ? 'careerObjective' : 'professionalSummary'
  const summaryLabel = resumeType === 'fresher' ? 'Career Objective' : 'Professional Summary'
  if (safeText(fd[summaryKey]).trim()) {
    const res = enhanceText(fd[summaryKey])
    if (res.text !== fd[summaryKey]) {
      fd[summaryKey] = res.text
      applied.push(summaryLabel)
    }
  }

  if (Array.isArray(fd.projects)) {
    fd.projects = fd.projects.map((p) => {
      if (!safeText(p.description).trim()) return p
      const res = enhanceText(p.description)
      if (res.text !== p.description) {
        applied.push(safeText(p.title).trim() || 'Project')
        return { ...p, description: res.text }
      }
      return p
    })
  }

  const expKey = resumeType === 'fresher' ? 'internship' : 'workExperience'
  const textKey = resumeType === 'fresher' ? 'description' : 'responsibilities'
  if (Array.isArray(fd[expKey])) {
    fd[expKey] = fd[expKey].map((entry) => {
      if (!safeText(entry[textKey]).trim()) return entry
      const res = enhanceText(entry[textKey])
      if (res.text !== entry[textKey]) {
        applied.push(safeText(entry.company).trim() || safeText(entry.role).trim() || safeText(entry.jobTitle).trim() || 'Experience')
        return { ...entry, [textKey]: res.text }
      }
      return entry
    })
  }

  return { formData: fd, applied }
}

export function buildSectionSuggestions(formData, resumeType) {
  return {
    summary: enhanceSummary(formData, resumeType),
    skills: enhanceSkills(formData.skills),
    projects: enhanceProjects(formData.projects),
    experience: enhanceExperience(
      resumeType === 'fresher' ? formData.internship : formData.workExperience,
      resumeType
    ),
  }
}

export function analyzeResume(formData, resumeType) {
  const ats = calculateAtsScore(formData, resumeType)

  const grammarSections = collectTextSections(formData, resumeType).map((s) => ({
    label: s.label,
    issues: checkGrammar(s.text),
  }))
  const grammarIssues = grammarSections.reduce((sum, s) => sum + s.issues.length, 0)
  const grammar = {
    issues: grammarIssues,
    sections: grammarSections,
    clean: grammarIssues === 0,
  }

  const keywordSuggestions = missingTechnicalKeywords(formData)

  const keywordCoverage = Math.min((ats.keywords.length / 8) * 100, 100)
  const grammarScore = Math.max(0, 100 - grammarIssues * 12)
  const strength = Math.round(0.6 * ats.total + 0.25 * grammarScore + 0.15 * keywordCoverage)
  const strengthLabel = strength >= 85
    ? 'Excellent'
    : strength >= 70
      ? 'Strong'
      : strength >= 55
        ? 'Good'
        : strength >= 40
          ? 'Needs Improvement'
          : 'Needs Work'

  return {
    ats,
    grammar,
    keywordSuggestions,
    strength: { score: strength, label: strengthLabel },
  }
}