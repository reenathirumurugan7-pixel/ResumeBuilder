export const ACTION_VERBS = [
  'achieved', 'improved', 'increased', 'reduced', 'developed', 'designed',
  'implemented', 'led', 'managed', 'created', 'built', 'launched',
  'optimized', 'streamlined', 'automated', 'delivered', 'negotiated',
  'organized', 'coordinated', 'established', 'initiated', 'pioneered',
  'mentored', 'trained', 'supervised', 'analyzed', 'evaluated', 'resolved',
  'collaborated', 'contributed', 'produced', 'generated', 'maintained',
  'executed', 'facilitated', 'spearheaded', 'directed', 'oversaw',
  'enhanced', 'transformed', 'revamped', 'conceptualized', 'formulated',
  'integrated', 'migrated', 'deployed', 'configured', 'troubleshot',
  'shipped', 'won',
]

export const TECHNICAL_KEYWORDS = [
  'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue',
  'node.js', 'express', 'django', 'flask', 'spring', 'sql', 'mysql',
  'postgresql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'docker',
  'kubernetes', 'git', 'github', 'gitlab', 'ci/cd', 'jenkins', 'terraform',
  'html', 'css', 'sass', 'tailwind', 'graphql', 'rest', 'api', 'microservices',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp',
  'data analysis', 'data science', 'pandas', 'numpy', 'matplotlib',
  'power bi', 'tableau', 'excel', 'agile', 'scrum', 'jira', 'confluence',
  'linux', 'bash', 'shell', 'firebase', 'supabase', 'vercel', 'netlify',
  'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
]

const QUANTIFIABLE_PATTERN = /\d+\s*(%|percent|k\b|m\b|million|billion|b\b|users?|clients?|projects?|teams?|hours?|minutes?|seconds?|pages?|features?|modules?|requests?|transactions?|revenue|sales|growth|increase|reduction|improvement|faster|slower|more|less)/i

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'are', 'was',
  'were', 'been', 'being', 'will', 'would', 'could', 'should', 'may', 'might',
  'can', 'shall', 'must', 'need', 'able', 'our', 'their', 'your', 'its', 'his',
  'her', 'who', 'which', 'what', 'where', 'when', 'how', 'why', 'about', 'into',
  'over', 'such', 'than', 'then', 'also', 'just', 'only', 'very', 'really',
  'some', 'each', 'most', 'much', 'many', 'more', 'other', 'these', 'those',
  'you', 'we', 'they', 'looking', 'role', 'work', 'help', 'plus', 'knowledge',
  'experience', 'strong', 'building', 'build', 'working', 'team', 'based',
])

function clamp(value, max) {
  return Math.min(Math.max(0, value), max)
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function safeStr(val) {
  return val == null ? '' : String(val).trim()
}

function hasContent(val) {
  return safeStr(val).length > 0
}

// A stored resume can predate the current schema (or have been hand-edited in
// the console), so an array may hold null or a primitive where an entry object
// belongs. Reading a property off one of those threw a TypeError that took the
// whole page down with it, because the ATS panel, the editor, Enhance Resume and
// the dashboard all score whatever is stored. Every list is therefore normalised
// before it is read. Scoring is untouched for well-formed data: a malformed entry
// simply scores as an empty one, which is what the field-length checks already
// assume.
function asEntry(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asEntryList(value) {
  return Array.isArray(value) ? value.map(asEntry) : []
}

// Coerces a skills-style list to strings without changing its length, so the
// count-based bonuses keep seeing the array the user actually has.
function asStringList(value) {
  return Array.isArray(value) ? value.map(safeStr) : []
}

function wordCount(text) {
  return safeStr(text).split(/\s+/).filter(Boolean).length
}

// ---------------------------------------------------------------------------
// Keyword / verb matching
//
// Plain `includes()` matching produced false positives that inflated the score:
// 'led' matched "called", "scheduled" and "enabled"; 'won' matched "downloaded",
// "own" and "shown"; 'vue' matched "avenue"; 'java' matched "javascript"; 'rest'
// matched "interest"; 'aws' matched "laws"; 'git' matched "digital". Every match
// is therefore anchored on word boundaries, with the common English inflections
// allowed so "developing" still counts as "develop".
// ---------------------------------------------------------------------------

const INFLECTIONS = '(?:e?s|d|ed|ing)?'
const matcherCache = new Map()

function buildMatcher(keyword, allowInflection) {
  const cacheKey = `${allowInflection ? 'i' : 'p'}:${keyword}`
  const cached = matcherCache.get(cacheKey)
  if (cached) return cached

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9])${escaped}${allowInflection ? INFLECTIONS : ''}(?![A-Za-z0-9])`,
    'i',
  )
  matcherCache.set(cacheKey, pattern)
  return pattern
}

function containsKeyword(text, keyword) {
  const value = safeStr(keyword)
  if (!value) return false
  return buildMatcher(value, true).test(safeStr(text))
}

function countMatches(text, words) {
  return words.filter((w) => containsKeyword(text, w)).length
}

function hasActionVerbs(text) {
  return ACTION_VERBS.some((v) => containsKeyword(text, v))
}

function hasQuantifiable(text) {
  return QUANTIFIABLE_PATTERN.test(safeStr(text))
}

function uniqueItems(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  return arr.filter((item) => {
    const key = safeStr(item).toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractKeywords(text) {
  const found = []
  TECHNICAL_KEYWORDS.forEach((kw) => {
    if (containsKeyword(text, kw)) found.push(kw)
  })
  return found
}

function buildResumeText(formData) {
  const fd = formData || {}
  return [
    safeStr(fd.careerObjective),
    safeStr(fd.professionalSummary),
    ...asEntryList(fd.education).map((e) => `${e.degree} ${e.department} ${e.college} ${e.university}`),
    ...asStringList(fd.skills),
    ...asEntryList(fd.languages).map((l) => (typeof l === 'string' ? l : l && l.name)),
    ...asEntryList(fd.projects).map((p) => `${p.title} ${p.description} ${p.technologies}`),
    ...asEntryList(fd.workExperience).map((e) => `${e.jobTitle} ${e.company} ${e.responsibilities}`),
    ...asEntryList(fd.internship).map((e) => `${e.role} ${e.company} ${e.description}`),
    ...asEntryList(fd.certifications).map((c) => c.name),
    ...asEntryList(fd.achievements).map((a) => a.name),
  ].join(' ')
}

function buildJobKeywords(jobDescription) {
  const lower = safeStr(jobDescription).toLowerCase()
  if (!lower) return []
  const technical = extractKeywords(lower)
  const words = lower.split(/[\s,;.()/:-]+/).filter((w) => {
    if (w.length < 3) return false
    return !STOP_WORDS.has(w)
  })
  return [...new Set([...technical, ...words])]
}

function scoreContact(personalInfo, resumeType, max) {
  let score = 0
  const details = []
  if (!personalInfo) return { score: 0, max, details }

  if (hasContent(personalInfo.fullName)) score += 2
  else details.push('Add your full name')
  if (hasContent(personalInfo.email)) score += 2
  else details.push('Add your email address')
  if (hasContent(personalInfo.phone)) score += 2
  else details.push('Add your phone number')
  if (hasContent(personalInfo.location)) score += 1
  else details.push('Add your location')
  if (hasContent(personalInfo.linkedin)) score += 0.5
  else details.push('Add your LinkedIn profile')
  if (hasContent(personalInfo.github) || (resumeType === 'experienced' && hasContent(personalInfo.portfolio))) {
    score += 0.5
  } else {
    details.push('Add a GitHub or portfolio link')
  }

  return { score: round1(clamp(score, max)), max, details }
}

function scoreSummary(text, resumeType, max) {
  const details = []
  const content = safeStr(text)

  if (!content) {
    details.push(resumeType === 'fresher' ? 'Add a career objective' : 'Add a professional summary')
    return { score: 0, max, details }
  }

  let score = 2
  const words = wordCount(content)
  if (words >= 20 && words <= 100) score += 3
  else if (words >= 10) score += 2
  else if (words >= 5) score += 1.5
  else score += 1

  if (words > 100) details.push('Consider shortening your summary (aim for 20-100 words)')
  else if (words < 10 && words >= 5) details.push('Expand your summary for more detail')
  else if (words < 5 && words > 0) details.push('Your summary is too short — add more detail')

  if (hasActionVerbs(content)) score += 2.5
  else details.push('Include action verbs in your summary')
  if (hasQuantifiable(content)) score += 2.5
  else details.push('Add measurable achievements to your summary')

  return { score: round1(clamp(score, max)), max, details }
}

function scoreEducation(education, max) {
  const details = []
  const entries = asEntryList(education)

  if (entries.length === 0) {
    details.push('Add your education details')
    return { score: 0, max, details }
  }

  const weights = [1, 0.55, 0.35, 0.25]
  let score = 0
  entries.forEach((edu, i) => {
    const w = weights[Math.min(i, weights.length - 1)]
    let s = 0
    if (hasContent(edu.degree)) s += 3
    if (hasContent(edu.college) || hasContent(edu.university)) s += 2.5
    if (hasContent(edu.startYear) || hasContent(edu.endYear)) s += 2
    if (hasContent(edu.cgpa)) s += 1.5
    score += Math.min(s, 9) * w
  })

  if (entries.every((e) => hasContent(e.degree) && (hasContent(e.college) || hasContent(e.university)))) {
    score += 1.5
  } else {
    details.push('Complete degree and institution for all education entries')
  }

  return { score: round1(clamp(score, max)), max, details }
}

function scoreSkills(skills, max) {
  const details = []
  const list = asStringList(skills)

  if (list.length === 0) {
    details.push('Add skills to your resume')
    return { score: 0, max, details }
  }

  let score = 0
  if (list.length >= 10) score += 7
  else if (list.length >= 7) score += 6
  else if (list.length >= 4) score += 4.5
  else if (list.length >= 2) score += 3
  else score += 1.5

  const unique = uniqueItems(list)
  if (unique.length === list.length) score += 2
  else details.push('Remove duplicate skills')

  const techCount = countMatches(list.join(' '), TECHNICAL_KEYWORDS)
  if (techCount >= 8) score += 11
  else if (techCount >= 5) score += 8
  else if (techCount >= 3) score += 6
  else if (techCount >= 1) score += 4

  if (techCount === 0) details.push('Add technical skills (programming languages, tools, frameworks)')
  else if (techCount < 3) details.push('Add more industry-relevant technical keywords')

  return { score: round1(clamp(score, max)), max, details }
}

function scoreProjects(projects, max) {
  const details = []
  const entries = asEntryList(projects)

  if (entries.length === 0) {
    details.push('Add projects to showcase your work')
    return { score: 0, max, details }
  }

  const weights = [1, 0.6, 0.4, 0.3]
  let score = 0
  entries.forEach((proj, i) => {
    const w = weights[Math.min(i, weights.length - 1)]
    let s = 0
    if (hasContent(proj.title)) s += 1.5
    if (hasContent(proj.technologies)) s += 2.5
    const desc = safeStr(proj.description)
    if (hasContent(desc)) {
      s += 2
      if (hasActionVerbs(desc)) s += 2
      if (hasQuantifiable(desc)) s += 4
    }
    if (hasContent(proj.link)) s += 1
    score += Math.min(s, 12) * w
  })

  if (entries.some((p) => hasContent(p.description) && wordCount(p.description) >= 20)) score += 2
  else details.push('Write detailed project descriptions (20+ words)')
  if (entries.some((p) => hasQuantifiable(p.description))) score += 2
  else details.push('Add measurable results to your projects (users, % improvements, accuracy)')

  return { score: round1(clamp(score, max)), max, details }
}

function scoreExperience(entries, resumeType, max) {
  const details = []
  const list = asEntryList(entries)
  const isFresher = resumeType === 'fresher'
  const textKey = isFresher ? 'description' : 'responsibilities'

  if (list.length === 0) {
    details.push(isFresher ? 'Add internships to strengthen your profile' : 'Add your work experience')
    return { score: 0, max, details }
  }

  const weights = [1, 0.55, 0.35, 0.25, 0.2]
  let score = 0
  list.forEach((exp, i) => {
    const w = weights[Math.min(i, weights.length - 1)]
    let s = 0
    if (isFresher) {
      if (hasContent(exp.company)) s += 2
      if (hasContent(exp.role)) s += 2
      if (hasContent(exp.duration)) s += 2
    } else {
      if (hasContent(exp.jobTitle)) s += 2
      if (hasContent(exp.company)) s += 2
      if (hasContent(exp.startDate) || hasContent(exp.endDate)) s += 2
    }
    const desc = safeStr(exp[textKey])
    if (hasContent(desc)) {
      s += 3
      if (hasActionVerbs(desc)) s += isFresher ? 2 : 5
      if (hasQuantifiable(desc)) s += isFresher ? 4 : 7
    }
    score += Math.min(s, 17) * w
  })

  if (list.every((e) => hasContent(e[textKey]))) score += 2
  else details.push(isFresher ? 'Add descriptions to all internship entries' : 'Add responsibilities to all experience entries')

  if (list.some((e) => hasQuantifiable(e[textKey]))) score += 2
  else details.push('Add quantifiable achievements (numbers, percentages, impact) to your experiences')

  return { score: round1(clamp(score, max)), max, details }
}

function scoreCertificationsAndAchievements(certifications, achievements, max) {
  const details = []
  const certs = asEntryList(certifications).filter((c) => hasContent(c.name))
  const ach = asEntryList(achievements).filter((a) => hasContent(a.name))

  if (certs.length === 0 && ach.length === 0) {
    details.push('Add certifications or achievements to stand out')
    return { score: 0, max, details }
  }

  let score = 0
  if (certs.length === 1) score += 1.5
  else if (certs.length === 2) score += 2.5
  else if (certs.length >= 3) score += 3

  if (ach.length === 1) score += 1.5
  else if (ach.length >= 2) score += 2
  if (ach.some((a) => wordCount(a.name) >= 6)) score += 1

  if (certs.length === 0) details.push('Add certifications relevant to your field')
  if (ach.length === 0) details.push('Add achievements or awards')

  return { score: round1(clamp(score, max)), max, details }
}

function scoreLanguages(languages, max) {
  const details = []
  const list = (Array.isArray(languages) ? languages : [])
    .map((l) => (typeof l === 'string' ? { name: l, proficiency: '' } : l || {}))
    .filter((l) => hasContent(l.name))

  if (list.length === 0) {
    details.push('Add languages')
    return { score: 0, max, details }
  }

  // Weighted to match the category maximum (3) so a fully filled Languages
  // section can actually reach 3/3 instead of being stuck at 2/3.
  let score = 0
  if (list.length >= 3) score += 2
  else if (list.length === 2) score += 1.5
  else score += 1

  const withProficiency = list.filter((l) => hasContent(l.proficiency)).length
  if (withProficiency === list.length && list.length > 0) score += 1
  else if (withProficiency >= Math.max(1, Math.floor(list.length / 2))) score += 0.5
  else details.push('Add a proficiency level to your languages')

  return { score: round1(clamp(score, max)), max, details }
}

function scoreKeywords(formData, resumeType, jobDescription, max) {
  const details = []
  const resumeText = buildResumeText(formData)
  const keywordsFound = extractKeywords(resumeText)
  const uniqueSkills = uniqueItems(asStringList(formData?.skills))
  const allKeywords = [...new Set([...keywordsFound, ...uniqueSkills.map((s) => s.toLowerCase())])]

  let score = 0
  const jdText = safeStr(jobDescription)

  if (!jdText) {
    if (allKeywords.length >= 4) score = 4
    else if (allKeywords.length >= 1) score = 2
    else details.push('Add more industry-relevant keywords to your resume')
    details.push('Paste a job description to unlock the job-match portion of your score')
  } else {
    const jobKeywords = buildJobKeywords(jdText)
    if (jobKeywords.length > 0) {
      const matched = jobKeywords.filter((kw) => containsKeyword(resumeText, kw))
      const coverage = matched.length / jobKeywords.length
      score = 1 + Math.round(coverage * 7)
      if (coverage >= 0.8) details.push('Excellent keyword alignment with the job description')
      else if (coverage >= 0.5) details.push('Decent job match — add the missing keywords your resume lacks')
      else details.push(`Only ${matched.length} of ${jobKeywords.length} job keywords found on your resume`)
    }
  }

  return { score: round1(clamp(score, max)), max, details, keywordsFound: allKeywords }
}

function collectSections(formData, resumeType) {
  const fd = formData || {}
  const isFresher = resumeType === 'fresher'
  const summaryKey = isFresher ? 'careerObjective' : 'professionalSummary'
  const expKey = isFresher ? 'internship' : 'workExperience'
  const pi = fd.personalInfo || {}

  const sections = [
    { label: 'Personal Information', present: hasContent(pi.fullName) || hasContent(pi.email) || hasContent(pi.phone) },
    { label: isFresher ? 'Career Objective' : 'Professional Summary', present: hasContent(fd[summaryKey]) },
    { label: 'Education', present: Array.isArray(fd.education) && fd.education.length > 0 },
    { label: 'Skills', present: Array.isArray(fd.skills) && fd.skills.length > 0 },
    { label: 'Projects', present: Array.isArray(fd.projects) && fd.projects.length > 0 },
    { label: isFresher ? 'Internships' : 'Work Experience', present: Array.isArray(fd[expKey]) && fd[expKey].length > 0 },
    {
      label: 'Certifications & Achievements',
      present:
        asEntryList(fd.certifications).some((c) => hasContent(c.name)) ||
        asEntryList(fd.achievements).some((a) => hasContent(a.name)),
    },
    { label: 'Languages', present: Array.isArray(fd.languages) && fd.languages.length > 0 },
  ]

  const missing = sections.filter((s) => !s.present).map((s) => s.label)
  return { sections, missing }
}

const BASE_WEIGHTS = {
  fresher: { contact: 8, summary: 10, education: 15, skills: 20, projects: 20, experience: 12, support: 5, languages: 3, keywords: 7 },
  experienced: { contact: 8, summary: 10, education: 10, skills: 20, projects: 10, experience: 22, support: 5, languages: 3, keywords: 12 },
}

function buildPlainText(formData) {
  const fd = formData || {}
  const pi = fd.personalInfo || {}
  return [
    pi.fullName, pi.email, pi.phone, pi.location, pi.linkedin, pi.github, pi.portfolio,
    fd.careerObjective,
    fd.professionalSummary,
    ...asEntryList(fd.education).map((e) => `${e.degree} ${e.department} ${e.college} ${e.university} ${e.cgpa}`),
    ...asStringList(fd.skills),
    ...asEntryList(fd.projects).map((p) => `${p.title} ${p.description} ${p.technologies}`),
    ...asEntryList(fd.workExperience).map((e) => `${e.jobTitle} ${e.company} ${e.location} ${e.responsibilities}`),
    ...asEntryList(fd.internship).map((e) => `${e.role} ${e.company} ${e.duration} ${e.description}`),
    ...asEntryList(fd.certifications).map((c) => c.name),
    ...asEntryList(fd.achievements).map((a) => a.name),
    ...asEntryList(fd.languages).map((l) => (typeof l === 'string' ? l : l && l.name)),
  ].filter(hasContent).join(' ')
}

export function calculateAtsScore(formData, resumeType, jobDescription = '') {
  if (!formData) {
    return { total: 0, max: 100, level: 'Poor', categories: [], suggestions: [], keywords: [], sections: [], missing: [], usedJobDescription: false }
  }

  const isFresher = resumeType === 'fresher'
  const w = isFresher ? BASE_WEIGHTS.fresher : BASE_WEIGHTS.experienced

  const contact = scoreContact(formData.personalInfo, resumeType, w.contact)
  const summary = scoreSummary(isFresher ? formData.careerObjective : formData.professionalSummary, resumeType, w.summary)
  const education = scoreEducation(formData.education, w.education)
  const skills = scoreSkills(formData.skills, w.skills)
  const projects = scoreProjects(formData.projects, w.projects)
  const experience = scoreExperience(
    isFresher ? formData.internship : formData.workExperience,
    resumeType,
    w.experience
  )
  const support = scoreCertificationsAndAchievements(formData.certifications, formData.achievements, w.support)
  const languages = scoreLanguages(formData.languages, w.languages)
  const keywords = scoreKeywords(formData, resumeType, jobDescription, w.keywords)

  const categories = [
    { label: 'Personal Information', ...contact },
    { label: isFresher ? 'Career Objective' : 'Professional Summary', ...summary },
    { label: 'Education', ...education },
    { label: 'Skills', ...skills },
    { label: 'Projects', ...projects },
    { label: isFresher ? 'Internship' : 'Work Experience', ...experience },
    { label: 'Certifications & Achievements', ...support },
    { label: 'Languages', ...languages },
    { label: 'Keywords & Job Match', ...keywords },
  ]

  let total = categories.reduce((sum, cat) => sum + cat.score, 0)

  const { sections, missing } = collectSections(formData, resumeType)
  const filledCount = sections.filter((s) => s.present).length
  if (filledCount >= 7) total += 4
  else if (filledCount >= 5) total += 2
  else if (filledCount >= 3) total += 1

  const plainText = buildPlainText(formData)
  // Only genuine junk is penalised: control characters, invisible formatting
  // characters and the Unicode replacement glyph. The previous check also docked
  // points for apostrophes, slashes, quotes, dashes, currency symbols and
  // accented letters, which are all normal in real resumes and are handled fine
  // by ATS parsers.
  if (/[\p{Cc}\p{Cf}\uFFFD]/u.test(plainText)) {
    total -= 3
  }
  // The category weights already add up to 100, and the completeness bonus below
  // can push the raw sum past it. Clamp so the reported score can never exceed
  // the displayed maximum.
  total = Math.round(Math.min(100, Math.max(0, total)))

  let level = 'Poor'
  if (total >= 95) level = 'Excellent'
  else if (total >= 85) level = 'Very Good'
  else if (total >= 70) level = 'Good'
  else if (total >= 50) level = 'Needs Improvement'

  const suggestions = categories.flatMap((cat) =>
    cat.details.map((d) => ({ category: cat.label, message: d }))
  )

  return {
    total,
    max: 100,
    level,
    categories,
    suggestions,
    keywords: keywords.keywordsFound || [],
    sections,
    missing,
    usedJobDescription: !!safeStr(jobDescription),
  }
}

export function matchJobDescription(formData, resumeType, jobDescription) {
  if (!jobDescription || !formData) {
    return { matchPercent: 0, matched: [], missing: [], resumeKeywords: [] }
  }

  const resumeText = buildResumeText(formData)
  const resumeKeywords = extractKeywords(resumeText)
  const jobKeywords = buildJobKeywords(jobDescription)

  const matched = jobKeywords.filter((kw) => containsKeyword(resumeText, kw))
  const missing = jobKeywords.filter((kw) => !containsKeyword(resumeText, kw))

  const matchPercent = jobKeywords.length > 0
    ? Math.round((matched.length / jobKeywords.length) * 100)
    : 0

  return {
    matchPercent,
    matched: matched.slice(0, 20),
    missing: missing.slice(0, 20),
    resumeKeywords,
    totalJobKeywords: jobKeywords.length,
  }
}