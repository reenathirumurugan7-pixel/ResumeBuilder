// Normalises untrusted resume data into the exact shape the editors, the live
// preview and storage expect.
//
// Two things can produce form data that a human did not type: the deterministic
// parser in resumeTextParser.js and the Gemini endpoint /api/ai/parse. Both
// results pass through here before anything is displayed or stored, so a string
// where a list belongs - or a list where a string belongs - can never reach a
// component that maps over it, localStorage, or Firestore.

/** Every list-valued field in the resume schema. These must stay arrays. */
export const RESUME_ARRAY_FIELDS = [
  'education', 'skills', 'languages', 'projects',
  'certifications', 'achievements', 'internship', 'workExperience',
]

const PERSONAL_INFO_FIELDS = [
  'fullName', 'email', 'phone', 'location', 'linkedin', 'github', 'portfolio',
]

// The exact keys each list entry is allowed to keep, and how long each may get.
const ENTRY_SHAPES = {
  education: {
    degree: 120, department: 120, college: 200, university: 200,
    startYear: 20, endYear: 20, cgpa: 40, cgpaMode: 20,
  },
  languages: { name: 80, proficiency: 60 },
  projects: { title: 200, technologies: 400, description: 4000, link: 300 },
  internship: { company: 200, role: 200, duration: 120, description: 4000 },
  workExperience: {
    company: 200, jobTitle: 200, location: 200,
    startDate: 60, endDate: 60, responsibilities: 4000,
  },
  certifications: { name: 300 },
  achievements: { name: 300 },
}

const CAPS = {
  education: 20,
  skills: 80,
  languages: 20,
  projects: 30,
  internship: 30,
  workExperience: 30,
  certifications: 40,
  achievements: 40,
}

const DEGREE_MODE = { cgpa: 'cgpa', percentage: 'percentage' }

/** Raised when imported data is structurally unusable. */
export class ResumeImportError extends Error {
  constructor(message, details = []) {
    super(message)
    this.name = 'ResumeImportError'
    this.details = details
  }
}

function cleanString(value, max) {
  if (typeof value === 'string') return value.trim().slice(0, max)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reports every structural problem in a form-data document.
 * Returns an array of human-readable strings; empty means the shape is safe.
 */
export function findShapeProblems(formData) {
  if (!isPlainObject(formData)) return ['the resume data is not an object']
  const problems = []
  for (const field of RESUME_ARRAY_FIELDS) {
    if (formData[field] !== undefined && formData[field] !== null && !Array.isArray(formData[field])) {
      problems.push(`"${field}" is a ${typeof formData[field]} but must be a list`)
      continue
    }
    const list = Array.isArray(formData[field]) ? formData[field] : []
    for (const entry of list) {
      // skills is a list of strings; every other list is a list of objects.
      if (field === 'skills') {
        if (typeof entry !== 'string') problems.push(`"skills" contains a ${typeof entry} but must contain text`)
      } else if (!isPlainObject(entry)) {
        problems.push(`"${field}" contains a ${Array.isArray(entry) ? 'list' : typeof entry} but must contain objects`)
      }
    }
  }
  if (formData.personalInfo !== undefined && formData.personalInfo !== null && !isPlainObject(formData.personalInfo)) {
    problems.push('"personalInfo" is not an object')
  }
  return problems
}

function normalizeEntry(raw, shape, index, batch) {
  const entry = {}
  for (const [field, max] of Object.entries(shape)) {
    entry[field] = cleanString(raw[field], max)
  }
  // Keep a stable key for React and for the editors' remove handler.
  entry.id = batch + index
  if (shape.cgpaMode !== undefined) {
    const percentage = /%/.test(entry.cgpa) || DEGREE_MODE.percentage === raw.cgpaMode
    entry.cgpaMode = percentage ? DEGREE_MODE.percentage : DEGREE_MODE.cgpa
  }
  return entry
}

function hasContent(entry) {
  return Object.entries(entry).some(([key, value]) => key !== 'id' && typeof value === 'string' && value.trim())
}

// Counts list entries that actually carry something. A raw AI answer can arrive
// with empty objects or blank strings in a list, which is not content.
function filledEntries(list) {
  if (!Array.isArray(list)) return 0
  return list.filter((entry) => {
    if (typeof entry === 'string') return entry.trim().length > 0
    if (!isPlainObject(entry)) return false
    return Object.values(entry).some((value) => (typeof value === 'string' ? value.trim() : value != null))
  }).length
}

// One stray line is not an objective. Real ones run to a sentence or two and read
// as English, so a length, a word count and a few ordinary function words are all
// required before prose counts as a section. Without this a file whose entire text
// is a name, a navigation bar ("Home About Contact") or repeated filler would read
// as a resume with a summary.
const SUMMARY_MIN_WORDS = 10
const SUMMARY_MIN_CHARS = 40
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these', 'those', 'my',
  'me', 'i', 'we', 'our', 'you', 'your', 'into', 'over', 'per', 'than', 'then', 'which', 'who', 'will',
  'would', 'can', 'could', 'should', 'have', 'has', 'had', 'do', 'does', 'not', 'no', 'while', 'within',
])

function readsAsProse(text) {
  const trimmed = text.trim()
  if (trimmed.length < SUMMARY_MIN_CHARS) return false
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < SUMMARY_MIN_WORDS) return false
  const functionWords = new Set(words.map((word) => word.toLowerCase().replace(/[^a-z]/g, '')))
  let hits = 0
  for (const word of functionWords) {
    if (FUNCTION_WORDS.has(word)) hits += 1
  }
  return hits >= 3
}

export const WEAK_IMPORT_MESSAGE =
  'Unable to import this file as a resume. Please upload a resume containing information such as your name, contact details, education, skills, projects, or experience.'

/**
 * Reports why imported content is too thin to be a resume, or null when it is
 * usable. Shared by the on-device parse and the AI answer so neither can be
 * accepted on its own terms.
 *
 * Deliberately permissive: nothing here demands a particular section, a
 * section count, or a minimum number of skills. A fresher resume with no
 * experience, no projects and two skills is still a resume, and one missing
 * field is never a reason to reject. What it insists on is at least one piece
 * of real resume content, because a name plus contact details is a contact
 * card rather than a resume — and because the parser will cheerfully read
 * "Hello", "Test Resume" or "Home About Contact" as a candidate's name.
 */
export function findWeakResumeReason(formData) {
  const fd = isPlainObject(formData) ? formData : {}
  const summary = String(fd.professionalSummary || fd.summary || fd.careerObjective || fd.objective || '')

  const sections = [
    filledEntries(fd.education),
    filledEntries(fd.skills),
    filledEntries(fd.projects),
    filledEntries(fd.workExperience),
    filledEntries(fd.internship),
    filledEntries(fd.certifications),
    filledEntries(fd.achievements),
    filledEntries(fd.languages),
    readsAsProse(summary) ? 1 : 0,
  ]

  // fullName, email, phone, location and the profile links are deliberately not
  // in this list: on their own they do not make a resume.
  return sections.some((count) => count > 0) ? null : WEAK_IMPORT_MESSAGE
}

/**
 * Converts untrusted form data into a document that matches the resume schema.
 *
 * @param {unknown} input Candidate form data from the parser or from the AI.
 * @param {{ resumeType?: 'fresher'|'experienced' }} [options]
 * @returns {{ formData: object, warnings: string[] }}
 * @throws {ResumeImportError} when the input cannot be trusted at all, or when
 * it holds too little to be a resume.
 */
export function normalizeImportedFormData(input, options = {}) {
  const resumeType = options.resumeType === 'experienced' ? 'experienced' : 'fresher'
  if (!isPlainObject(input)) {
    throw new ResumeImportError('The imported resume data was not in the expected format.')
  }

  const problems = []
  const warnings = []
  const rawInfo = isPlainObject(input.personalInfo) ? input.personalInfo : {}

  const personalInfo = {}
  for (const field of PERSONAL_INFO_FIELDS) {
    personalInfo[field] = cleanString(rawInfo[field], field === 'fullName' ? 120 : 300)
  }

  // A list field that arrived as a scalar is recorded, then rebuilt as a list.
  const readList = (field) => {
    const value = input[field]
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) {
      problems.push(`"${field}" arrived as a ${typeof value}`)
      return []
    }
    return value
  }

  const education = readList('education')
    .slice(0, CAPS.education)
    .map((raw, i) => normalizeEntry(isPlainObject(raw) ? raw : {}, ENTRY_SHAPES.education, i, 1000000))
    .filter(hasContent)

  const projects = readList('projects')
    .slice(0, CAPS.projects)
    .map((raw, i) => normalizeEntry(isPlainObject(raw) ? raw : {}, ENTRY_SHAPES.projects, i, 2000000))
    .filter(hasContent)

  const languages = readList('languages')
    .slice(0, CAPS.languages)
    .map((raw, i) => {
      const source = typeof raw === 'string' ? { name: raw } : (isPlainObject(raw) ? raw : {})
      return normalizeEntry(source, ENTRY_SHAPES.languages, i, 3000000)
    })
    .filter(hasContent)

  const certifications = readList('certifications')
    .slice(0, CAPS.certifications)
    .map((raw, i) => {
      const source = typeof raw === 'string' ? { name: raw } : (isPlainObject(raw) ? raw : {})
      return normalizeEntry(source, ENTRY_SHAPES.certifications, i, 4000000)
    })
    .filter(hasContent)

  const achievements = readList('achievements')
    .slice(0, CAPS.achievements)
    .map((raw, i) => {
      const source = typeof raw === 'string' ? { name: raw } : (isPlainObject(raw) ? raw : {})
      return normalizeEntry(source, ENTRY_SHAPES.achievements, i, 5000000)
    })
    .filter(hasContent)

  const internship = readList('internship')
    .slice(0, CAPS.internship)
    .map((raw, i) => normalizeEntry(isPlainObject(raw) ? raw : {}, ENTRY_SHAPES.internship, i, 6000000))
    .filter(hasContent)

  const workExperience = readList('workExperience')
    .slice(0, CAPS.workExperience)
    .map((raw, i) => normalizeEntry(isPlainObject(raw) ? raw : {}, ENTRY_SHAPES.workExperience, i, 7000000))
    .filter(hasContent)

  const seenSkills = new Set()
  const skills = readList('skills')
    .slice(0, 400)
    .map((raw) => (typeof raw === 'string' ? raw : isPlainObject(raw) ? raw.name : ''))
    .map((value) => cleanString(value, 120))
    .filter((value) => {
      const key = value.toLowerCase()
      if (!value || seenSkills.has(key)) return false
      seenSkills.add(key)
      return true
    })
    .slice(0, CAPS.skills)

  const summary = cleanString(input.professionalSummary || input.summary, 4000)
  const objective = cleanString(input.careerObjective || input.objective, 4000)

  const formData = {
    personalInfo,
    careerObjective: resumeType === 'fresher' ? (objective || summary) : '',
    professionalSummary: resumeType === 'experienced' ? (summary || objective) : '',
    education,
    skills,
    languages,
    projects,
    certifications,
    achievements,
    internship,
    workExperience,
  }

  const finalProblems = findShapeProblems(formData)
  if (finalProblems.length) {
    throw new ResumeImportError(
      `The imported resume data was not in the expected format (${finalProblems.join('; ')}).`,
      finalProblems,
    )
  }

  if (problems.length) {
    warnings.push(
      `Some imported fields were ignored because they were not in the right format: ${problems.join(', ')}.`,
    )
  }

  const weak = findWeakResumeReason(formData)
  if (weak) {
    throw new ResumeImportError(weak)
  }

  return { formData, warnings }
}