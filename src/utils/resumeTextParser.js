// Turns the plain text of a PDF/DOCX resume into the ResumeBuilder form shape.
//
// This is the deterministic, offline half of the import. It recognises the
// sections a resume normally has, fills what it can, and reports every section
// it could not find so the UI can warn instead of silently dropping data. The
// optional Gemini pass (see services/aiParsing.js) refines the same text;
// either result is validated before it reaches the page.
//
// Output always matches the schema the editors read:
//   personalInfo { fullName, email, phone, location, linkedin, github, portfolio }
//   education[]  { degree, department, college, university, startYear, endYear, cgpa, cgpaMode }
//   skills[]     strings
//   languages[]  { name, proficiency }
//   projects[]   { title, technologies, description, link }
//   workExperience[] { company, jobTitle, location, startDate, endDate, responsibilities }
//   internship[] { company, role, duration, description }
//   certifications[] / achievements[] { name }
//   professionalSummary (experienced) or careerObjective (fresher)

const MONTH_PATTERN =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'

const DATE_RANGE = new RegExp(
  `\\b(?:${MONTH_PATTERN})?[\\s./-]*(?:19|20)\\d{2}\\b\\s*(?:-|\u2013|\u2014|to|until|/)\\s*` +
    `(?:(?:${MONTH_PATTERN})?[\\s./-]*)?(?:(?:19|20)\\d{2}|present|current|now|today|ongoing)\\b`,
  'i',
)

const YEAR = /\b(19|20)\d{2}\b/
const PERCENT_VALUE = /\d{1,3}(?:\.\d{1,2})?\s*%/
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[A-Za-z0-9\-_%/.]+/i
const GITHUB = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?github\.com\/[A-Za-z0-9\-_%/.]+/i
const ANY_URL = /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\/[A-Za-z0-9\-_%/?.=&#]*/i
const ANY_URL_GLOBAL = new RegExp(ANY_URL.source, 'gi')

const ROLE = new RegExp(
  '\\b(engineer|developer|programmer|analyst|manager|intern|designer|consultant|lead|director|executive|associate|specialist|architect|administrator|officer|scientist|technician|accountant|marketer|recruiter|supervisor|coordinator|founder|freelancer|trainee|assistant|department)\\b',
  'i',
)
const COMPANY = new RegExp(
  '\\b(inc|llc|ltd|limited|pvt|corp|corporation|company|technologies|solutions|systems|software|services|consultancy|consulting|labs|enterprises|industries|group|holdings|bank)\\b',
  'i',
)
const DEGREE = new RegExp(
  '\\b(10th|12th|sslc|hsc|puc|iti|diploma|bachelor|master|b\\.?\\s?(tech|sc|com|ba|ca|bcs|tech)|m\\.?\\s?(tech|sc|com|ma|ca|tech)|bca|mca|b\\.?\\s?e\\.?|m\\.?\\s?e\\.?|btech|mtech|ph\\.?d|m\\.?\\s?phil|associate\\s+degree|doctorate|post\\s*graduate|undergraduate)\\b',
  'i',
)
const INSTITUTION = /\b(university|college|institute|institution|school|academy|polytechnic|campus|conservatory)\b/i
const SCORE = /\b(cgpa|gpa|sgpa|percentage|percent|marks|score|grade)\b/i
const TECH_LABEL = /\b(technolog\w*|tech\s*stack|tools?|built\s+with|stack|frameworks?|libraries|programming\s+languages)\b\s*:?\s*$/i

// The same words, but introducing the values rather than closing the line:
// "Technologies: Java, MySQL", "Tech Stack: Python | Pandas". A label is the
// strong evidence a technology list needs, so it is recognised on its own even
// when a single value follows.
const TECH_LABEL_WORDS =
  'technolog\\w*|tech\\s*nolog\\w*|tech\\s*stack|tools?(?:\\s*(?:used|and\\s*technolog\\w*))?|built\\s+with|stack|frameworks?|libraries|programming\\s+languages'
const TECH_LABEL_HEAD = new RegExp(`^\\s*(?:${TECH_LABEL_WORDS})\\s*:\\s*(.+)$`, 'i')

// "TECHNOLOGIES" doubles as a skills section and as a field inside a project.
// While a project is being read the inline form belongs to that project: it must
// not end the project or be filed as a skill. Everywhere else it keeps behaving
// as the skills section it has always been. Resolved by context in matchHeading.
const SKILLS_HEADING = {
  key: 'skills',
  label: 'Skills',
  re: /^(technical\s+skills|soft\s+skills|professional\s+skills|personal\s+skills|interpersonal\s+skills|core\s+competencies|key\s+skills|skills\s*(&|and)\s*tools|skills|competencies|technical\s+competencies)\b/i,
  // "TECHNOLOGIES" is a skills section in some resumes and a field inside a
  // project in others, so it is matched separately and resolved by context.
  techRe: /^(?:technologies|technology|tech\s+nologies|tech\s*stack)\b/i,
}

// "TECHNOLOGIES" doubles as a skills section and as a field inside a project.
// While a project is being read the inline form belongs to that project: it must
// not end the project or be filed as a skill. Everywhere else it keeps behaving
// as the skills section it has always been.
const HEADINGS = [
  { key: 'summary', label: 'Summary', re: /^(professional\s+summary|executive\s+summary|career\s+objective|professional\s+objective|objective|summary|profile|about\s+me|about|personal\s+statement|professional\s+profile)\b/i },
  { key: 'experience', label: 'Work experience', re: /^(work\s+experience|professional\s+experience|employment(\s+history)?|work\s+history|experience|career\s+history)\b/i },
  { key: 'internship', label: 'Internship', re: /^(internships?|internship\s+experience|training)\b/i },
  { key: 'education', label: 'Education', re: /^(education|academic\s+(background|qualifications?)|educational\s+qualifications|qualifications?)\b/i },
  SKILLS_HEADING,
  { key: 'projects', label: 'Projects', re: /^(academic\s+projects|personal\s+projects|key\s+projects|projects?|portfolio)\b/i },
  { key: 'certifications', label: 'Certifications', re: /^(certifications?|licenses?|licences?|courses?)\b/i },
  { key: 'achievements', label: 'Achievements', re: /^(achievements?|accomplishments?|awards?\s*(&|and)?\s*honou?rs?|honou?rs?|awards?)\b/i },
  { key: 'languages', label: 'Languages', re: /^(languages?\s*(?:known|spoken|proficiency)?|linguistic\s+proficiency)\b/i },
]

// Guards against pathological documents: a resume holds a handful of entries per
// section, so anything far beyond that is noise rather than data.
const LIMITS = {
  education: 20,
  skills: 80,
  languages: 20,
  projects: 30,
  experience: 30,
  certifications: 40,
  achievements: 40,
  summary: 2000,
  description: 4000,
}

function toLines(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
}

function stripBullet(line) {
  return String(line || '')
    .replace(/^[\s\u2022\u25cf\u25aa\u25e6\u2023\u2219\u00b7\u00bb*>–—-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBulletLine(line) {
  return /^[\s\u2022\u25cf\u25aa\u25e6\u2023\u2219\u00b7*>–—-]+/.test(String(line || ''))
}

function pushLimited(list, value, key) {
  if (list.length >= (LIMITS[key] || 100)) return
  list.push(value)
}

function splitOnPipes(line) {
  return String(line || '')
    .split(/\s*[|•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

// A header line is short, is not a bullet and carries no sentence punctuation:
// that is what separates "Senior Developer" from the bullet below it.
function isHeaderLine(line) {
  const clean = stripBullet(line)
  if (!clean) return false
  if (isBulletLine(line)) return false
  if (clean.length > 90) return false
  if (clean.split(/\s+/).length > 14) return false
  return true
}

// Returns the heading a line introduces plus whatever followed it on the same
// line: a layout that writes "PROJECT Smart ResumeHub" or "SKILLS: Python, Java"
// must not lose that content, and must not push it into the following section.
//
// `openKey` is the section currently being read. It settles the one ambiguous
// case: "Technologies: Java, MySQL" is a skills section outside a project and a
// project's own stack inside one.
function matchHeading(line, openKey) {
  if (isBulletLine(line)) return null
  const clean = stripBullet(line).replace(/[:–—-]+$/, '').trim()
  if (!clean || clean.length > 60 || clean.split(/\s+/).length > 6) return null

  let skillsRe = SKILLS_HEADING.re
  if (SKILLS_HEADING.techRe.test(clean)) {
    if (openKey === 'projects') return null
    skillsRe = SKILLS_HEADING.techRe
  }

  for (const heading of HEADINGS) {
    const re = heading === SKILLS_HEADING ? skillsRe : heading.re
    const match = clean.match(re)
    if (match) {
      return {
        heading,
        rest: clean.slice(match[0].length).replace(/^[\s:|,;–—-]+/, '').trim(),
      }
    }
  }
  return null
}

// Finds every "SECTION HEADING" line and hands each one the lines that follow
// it, up to the next heading. A repeated heading of the same kind is merged so
// a resume that lists "Skills" twice does not lose the second block.
function detectSections(lines) {
  const marks = []
  let openKey = null
  for (let i = 0; i < lines.length; i += 1) {
    const found = matchHeading(lines[i], openKey)
    if (found) {
      marks.push({ index: i, heading: found.heading, rest: found.rest })
      openKey = found.heading.key
    }
  }

  const sections = []
  const byKey = new Map()
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i]
    const end = i + 1 < marks.length ? marks[i + 1].index : lines.length
    const body = lines.slice(mark.index + 1, end)
    // "PROJECTS 2" or "SKILLS -" leaves a bare counter behind, not content.
    if (mark.rest && !/^\d{1,3}$/.test(mark.rest)) body.unshift(mark.rest)
    const existing = byKey.get(mark.heading.key)
    if (existing) {
      existing.lines.push(...body)
    } else {
      const created = { key: mark.heading.key, label: mark.heading.label, lines: body }
      byKey.set(mark.heading.key, created)
      sections.push(created)
    }
  }
  return sections
}

function extractDateRange(line) {
  const match = String(line || '').match(DATE_RANGE)
  if (!match) return null
  const parts = match[0]
    .split(/\s*(?:-|–|—|to|until)\s*|\s*\/\s*/i)
    .map((part) => part.replace(/\s+/g, ' ').trim())
  return { start: parts[0] || '', end: parts.length > 1 ? parts.slice(1).join(' ') : '', text: match[0] }
}

function firstMatch(text, re) {
  const match = String(text || '').match(re)
  return match ? match[0].replace(/[),.;]+$/, '') : ''
}

// ---------------------------------------------------------------- contact block

// A phone number is an optional country code plus at least two runs of digits,
// joined by spaces, dots or hyphens, with an optional parenthesised area code.
// Requiring two runs keeps single numbers out: years ("2022"), scores ("8.7"),
// counts ("4000") and pin codes never match, and a year range ("2018 - 2022")
// is rejected by the YEAR guard below.
const PHONE_LABEL = /\b(?:phone|mobile|tel|telephone|ph|call|contact)\b\s*[.:=-]?\s*/i
const PHONE_CANDIDATE =
  /(?:\+\d{1,3}[\s.-]*)?(?:\(\d{2,5}\)[\s.-]*)?\d{2,5}(?:[\s.-]+\d{2,5}|\d{2,5}){1,3}/g

function detectPhone(lines) {
  const candidates = []

  for (const line of lines.slice(0, 14)) {
    const labelled = PHONE_LABEL.test(line)
    for (const raw of String(line).match(PHONE_CANDIDATE) || []) {
      // Keep the candidate exactly as written so the country code, spacing,
      // hyphens and parentheses survive into the form.
      const text = raw.replace(/[\s.,;:=()-]+$/, '').trim()
      const digits = text.replace(/\D/g, '')
      // A phone needs 7-15 digits; a year or a date range never qualifies.
      if (digits.length < 7 || digits.length > 15 || YEAR.test(text)) continue
      candidates.push({ text, digits: digits.length, labelled })
    }
  }

  if (!candidates.length) return ''
  // An explicitly labelled number wins; otherwise the longest run is the number
  // and the shorter ones are dates or extension numbers.
  const labelled = candidates.filter((candidate) => candidate.labelled)
  const pool = (labelled.length ? labelled : candidates).slice()
  pool.sort((a, b) => b.digits - a.digits)
  return pool[0].text
}

function detectPortfolio(lines, linkedin, github) {
  for (const line of lines.slice(0, 20)) {
    for (const raw of line.match(ANY_URL_GLOBAL) || []) {
      const url = raw.replace(/[),.;]+$/, '')
      if (/linkedin\.com|github\.com/i.test(url)) continue
      if (url === linkedin || url === github) continue
      return url
    }
  }
  return ''
}

function collectContacts(lines) {
  const joined = lines.join('\n')
  const header = lines.slice(0, 14).join('\n')

  const email = firstMatch(header, EMAIL) || firstMatch(joined, EMAIL)
  const linkedin = firstMatch(header, LINKEDIN) || firstMatch(joined, LINKEDIN)
  const github = firstMatch(header, GITHUB) || firstMatch(joined, GITHUB)

  return {
    email,
    phone: detectPhone(lines),
    linkedin,
    github,
    portfolio: detectPortfolio(lines, linkedin, github),
  }
}

function looksLikeName(line) {
  const clean = stripBullet(line)
  if (!clean || clean.length < 3 || clean.length > 60) return false
  if (EMAIL.test(clean) || ANY_URL.test(clean)) return false
  if (YEAR.test(clean) || detectPhone([clean])) return false
  const words = clean.split(/\s+/)
  if (words.length < 2 || words.length > 5) return false
  // "PROFESSIONAL SUMMARY" is two capitalised words and reads like a name; a
  // section heading is never one.
  if (matchHeading(clean)) return false
  // "B.Sc. Computer Science" is three capitalised words, so the shape of a name,
  // but a qualification is never the candidate.
  if (DEGREE.test(clean)) return false
  return words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))
}

// A document title rather than a name, in case one sits on the top line.
const DOC_TITLE = /^(?:resume|cv|curriculum\s+vitae|biodata|details?|information|profile|contacts?)$/i

function looksLikeSoleName(line) {
  const clean = stripBullet(line)
  if (!clean || clean.length < 3 || clean.length > 40) return false
  if (/\s/.test(clean)) return false
  if (!/^[A-Za-z][A-Za-z.'-]*$/.test(clean)) return false
  if (EMAIL.test(clean) || ANY_URL.test(clean)) return false
  if (YEAR.test(clean) || detectPhone([clean])) return false
  if (ROLE.test(clean) || DOC_TITLE.test(clean)) return false
  if (matchHeading(clean)) return false
  return true
}

function detectName(headerLines, allLines) {
  // Nothing is printed above the top line, so a lone word there is the name even
  // though it has no second word to be matched with. Templates habitually pair it
  // with a headline underneath ("REENA" over "ASPIRING DATA ANALYST"), and the
  // two-word rule below would otherwise award the name to the headline.
  const top = stripBullet(headerLines[0] || '')
  if (top && looksLikeSoleName(top)) return top

  for (const line of headerLines) {
    if (looksLikeName(line)) return stripBullet(line)
  }
  // Some templates place the name lower down, beside the contact block.
  for (const line of allLines.slice(0, 20)) {
    if (looksLikeName(line)) return stripBullet(line)
  }
  return ''
}

// A place is written in words only: no digits (that is a phone number or a
// date), no "@" (an email address) and no "/" (a URL). Up to four words per
// comma-separated part keeps "Chennai, Tamil Nadu" while rejecting prose.
const LOCATION_WORD = /^[A-Za-z][A-Za-z.'-]*(?: [A-Za-z][A-Za-z.'-]*){0,3}$/

function locationCandidate(segment) {
  const text = segment.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '')
  if (text.length < 3 || text.length > 60) return ''
  if (/[@\d/\\]/.test(text)) return ''
  if (!/[A-Za-z]{2}/.test(text)) return ''
  if (ANY_URL.test(text) || LINKEDIN.test(text) || GITHUB.test(text)) return ''
  // A headline under the name ("ASPIRING DATA ANALYST") is written like a place
  // - short, capitalised, no digits - so the job-title words are what separate
  // the two.
  if (ROLE.test(text)) return ''
  if (matchHeading(text)) return ''
  const parts = text.split(/\s*[,;]\s*/).filter(Boolean)
  if (parts.length < 1 || parts.length > 3) return ''
  if (!parts.every((part) => LOCATION_WORD.test(part))) return ''
  return text
}

// Contact lines mix a place with an email and a phone number, so the whole line
// is never a location. Each pipe/comma separated chunk is judged on its own and
// a "City, Region" pair is preferred, which is how a place is normally written.
function detectLocation(headerLines, name) {
  const candidateName = String(name || '').trim().toLowerCase()
  const candidates = []

  for (const line of headerLines) {
    for (const segment of splitOnPipes(line)) {
      const whole = locationCandidate(segment)
      if (whole) candidates.push(whole)
      // "priya@example.com, +91 98765 43210, Chennai, Tamil Nadu" arrives as one
      // chunk, so neighbouring comma-separated words are retried as a pair.
      const parts = segment.split(/\s*[,;]\s*/).filter(Boolean)
      for (let i = 0; i + 1 < parts.length; i += 1) {
        const pair = locationCandidate(`${parts[i]}, ${parts[i + 1]}`)
        if (pair) candidates.push(pair)
      }
    }
  }

  const usable = candidates.filter((value) => value.toLowerCase() !== candidateName)
  const withRegion = usable.find((value) => value.includes(','))
  return withRegion || usable[0] || ''
}

// -------------------------------------------------------------------- summary

/**
 * Strips contact details out of a line so a header that mixes them with prose
 * cannot push an email address, phone number, profile link, place or the
 * candidate's own name into the summary. A line that carries no contact detail
 * at all is prose and is kept as it is.
 */
function stripContactParts(line, name) {
  const target = String(name || '').trim().toLowerCase()
  let text = String(line || '')
  const hasContact =
    EMAIL.test(text) || ANY_URL.test(text) || LINKEDIN.test(text) || GITHUB.test(text) ||
    Boolean(detectPhone([text]))

  text = text.replace(ANY_URL_GLOBAL, ' ').replace(EMAIL, ' ').replace(PHONE_CANDIDATE, ' ')

  return splitOnPipes(text)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.toLowerCase() !== target)
    // On a contact line the remaining short chunks are the address.
    .filter((part) => !(hasContact && locationCandidate(part)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|,;]+|[\s|,;]+$/g, '')
    .trim()
}

function parseSummary(lines, name) {
  const parts = []
  for (const line of lines) {
    const clean = stripContactParts(line, name)
    if (clean) parts.push(clean)
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.summary)
}

// --------------------------------------------------------------------- skills

function parseSkills(lines) {
  const skills = []
  const seen = new Set()

  const add = (value) => {
    const cleaned = String(value || '')
      .replace(/^[\s\-–—:*•]+/, '')
      .replace(/[:\s]+$/, '')
      .replace(/\s*\(\s*\d{4}\s*\)\s*$/, '')
      .trim()
    // A skill is a short label, never a sentence.
    if (!cleaned || cleaned.length > 60 || cleaned.split(/\s+/).length > 6) return
    const key = cleaned.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    pushLimited(skills, cleaned, 'skills')
  }

  for (const raw of lines) {
    const line = stripBullet(raw)
    if (!line) continue
    for (const part of line.split(/\s*[|•]\s*|\s*,\s*/)) {
      const clean = part.trim()
      if (!clean) continue
      // "Programming Languages: Python, Java" contributes only the values.
      const labelled = clean.match(/^([^:]{2,40}):\s*(.+)$/)
      const values = labelled ? labelled[2] : clean
      if (!values.trim()) continue
      for (const item of values.split(',')) add(item)
    }
  }

  return skills
}

// ------------------------------------------------------------------ languages

const PROFICIENCY = ['native', 'fluent', 'advanced', 'intermediate', 'basic', 'conversational', 'working proficiency']

function parseLanguages(lines) {
  const languages = []
  const seen = new Set()

  for (const raw of lines) {
    const line = stripBullet(raw)
    if (!line) continue
    for (const part of line.split(/\s*[|•]\s*|\s*,\s*/)) {
      const clean = part.trim().replace(/^languages?\s*:\s*/i, '')
      if (!clean) continue
      const match = clean.match(/^(.+?)\s*[-–—(:]\s*(.+?)\)?\s*$/)
      let name = clean
      let proficiency = ''
      if (match) {
        const level = match[2].trim().toLowerCase()
        if (PROFICIENCY.some((known) => level.includes(known))) {
          name = match[1].trim()
          proficiency = match[2].trim()
        }
      }
      if (!name || name.length > 40 || name.split(/\s+/).length > 3) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      pushLimited(languages, { name, proficiency }, 'languages')
    }
  }

  return languages
}

// ------------------------------------------------- name-only collections

function parseNameList(lines, limitKey) {
  const entries = []
  for (const raw of lines) {
    const clean = stripBullet(raw)
    if (!clean || clean.length > 300) continue
    pushLimited(entries, { name: clean }, limitKey)
  }
  return entries
}

// ------------------------------------------------------------------ education

// Greedy field assignment: each line contributes to the current entry until a
// line proves a new entry has started. That handles both "degree, school, years"
// and "years, degree, school" orderings without assuming one fixed layout.
function parseEducation(lines) {
  const entries = []
  let current = null

  const startEntry = () => {
    current = { degree: '', institution: '', years: '', score: '' }
    entries.push(current)
  }

  for (const raw of lines) {
    for (const part of splitOnPipes(raw)) {
      const line = stripBullet(part)
      if (!line) continue

      const years = extractDateRange(line)
      const hasYear = Boolean(years) || YEAR.test(line)
      const hasDegree = DEGREE.test(line)
      const hasInstitution = INSTITUTION.test(line)
      const percent = line.match(PERCENT_VALUE)
      const hasScore = SCORE.test(line) || Boolean(percent)

      const filled = (field) => Boolean(current && current[field])
      const startsNew =
        (hasDegree && filled('degree')) ||
        (hasInstitution && filled('institution')) ||
        (hasYear && filled('years') && (filled('degree') || filled('institution')))

      if (!current || startsNew) startEntry()

      if (years) {
        current.years = years.text
      } else if (hasYear && !filled('years')) {
        current.years = line.match(/\b((?:19|20)\d{2})\b/)[1]
      } else if (hasScore) {
        const value = line.match(PERCENT_VALUE) || line.match(/\d+(?:\.\d{1,2})?/)
        current.score = value ? value[0].replace(/\s+/g, '') : line
      } else if (hasDegree && !filled('degree')) {
        current.degree = line
      } else if (hasInstitution && !filled('institution')) {
        current.institution = line
      } else if (!filled('institution') && !hasYear) {
        current.institution = line
      }
    }
  }

  return entries
    .filter((entry) => entry.degree || entry.institution || entry.years || entry.score)
    .slice(0, LIMITS.education)
    .map((entry) => {
      const built = {
        degree: entry.degree,
        department: '',
        college: '',
        university: '',
        startYear: entry.years,
        endYear: entry.years,
        cgpa: entry.score,
        cgpaMode: /%/.test(entry.score) ? 'percentage' : 'cgpa',
      }
      const splitDegree = built.degree.match(/^(.*?)\b(?:in|of)\s+(.+)$/i)
      if (splitDegree) {
        built.degree = splitDegree[1].trim()
        built.department = splitDegree[2].trim()
      }
      if (/university/i.test(entry.institution)) built.university = entry.institution
      else built.college = entry.institution
      if (/university|college|institute|school|academy/i.test(entry.institution)) {
        const years = entry.years.match(/\b((?:19|20)\d{2})\b/g)
        if (years && years.length > 1) {
          built.startYear = years[0]
          built.endYear = years[1]
        } else if (years) {
          built.endYear = years[0]
          built.startYear = ''
        }
      }
      return built
    })
}

// ---------------------------------------------------------------- experience

// Splits a combined line such as "Software Engineer at Acme Corp" or
// "Acme Corp - Software Engineer" into its two halves.
function splitTitleLine(line) {
  const parts = line
    .split(/\s+(?:at|@|\||,|–)\s+|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const role = parts.find((part) => ROLE.test(part))
  const company = parts.find((part) => part !== role && (COMPANY.test(part) || /^[A-Z]/.test(part)))
  if (role && company) return { role, company }
  return null
}

function assignRoleAndCompany(headers) {
  let role = headers.find((header) => ROLE.test(header)) || ''
  let company = headers.find((header) => header !== role && COMPANY.test(header)) || ''
  if (!role && company) {
    role = headers.find((header) => header !== company) || ''
  } else if (!company) {
    company = headers.find((header) => header !== role) || ''
  }
  return { role, company }
}

// A responsibility line can pass every header-line test: "Led migration of 12
// services to Kubernetes, cutting deployment time by 40 percent." is short, has
// no bullet, and contains "services", which COMPANY matches. Left alone that
// splits one job into two, with the bullet as the second job's title and the
// real entry demoted to responsibilities. Only a line that does not read like a
// finished sentence, and is short enough to be a name plate, may open a new
// entry.
function looksLikeResponsibility(line) {
  const clean = stripBullet(line)
  if (!clean) return true
  if (/[.!?:,;]\s*$/.test(clean)) return true
  return clean.split(/\s+/).length > 10
}

function parseExperience(lines, kind) {
  const isInternship = kind === 'internship'
  const entries = []
  let current = null

  for (const raw of lines) {
    const line = stripBullet(raw)
    if (!line) continue

    const dates = extractDateRange(line)
    // A line often carries the dates plus the title, e.g.
    // "Jan 2022 - Present | Software Engineer | Acme Corp".
    let rest = dates ? line.replace(dates.text, ' ').replace(/\s*[|–-]\s*$/, '').replace(/\s+/g, ' ').trim() : line

    const hasContent = Boolean(current && (current.dates || current.header.length || current.description.length))
    const looksLikeHeader =
      isHeaderLine(raw) &&
      !dates &&
      !looksLikeResponsibility(raw) &&
      (ROLE.test(rest) || COMPANY.test(rest))
    // A line that is nothing but a date range ("2021 - Present") belongs to the
    // entry above it. Counting it as a new entry is what split one job in two:
    // the dates landed on an empty entry and the following responsibility line,
    // which passes every header test because it contains a word like
    // "services", became that entry's title.
    const datesOnly = Boolean(dates) && !rest
    const startsNew = datesOnly
      ? false
      : dates
        ? hasContent && Boolean(current.dates || current.description.length)
        : hasContent && looksLikeHeader && Boolean(current.dates) && current.header.length >= 2

    if (!current || startsNew) {
      current = { header: [], dates: null, description: [], location: '' }
      entries.push(current)
    }

    if (dates) current.dates = dates
    if (!rest) continue

    const location = rest.match(/^(?:location|based in)\s*:\s*(.+)$/i)
    if (location && !isBulletLine(raw)) {
      current.location = location[1].trim()
      continue
    }

    const looksLikeHeaderNow = (isHeaderLine(raw) && !isBulletLine(raw)) && (ROLE.test(rest) || COMPANY.test(rest))
    if (looksLikeHeaderNow && (!current.header.length || !current.dates)) {
      const both = !current.header.length ? splitTitleLine(rest) : null
      if (both) {
        current.header.push(both.role, both.company)
      } else {
        current.header.push(rest)
      }
      continue
    }

    if (!current.header.length && !current.dates && isHeaderLine(raw) && !isBulletLine(raw) && rest.length < 60) {
      current.header.push(rest)
      continue
    }

    current.description.push(rest)
  }

  return entries
    .filter((entry) => entry.header.length || entry.description.length || entry.dates)
    .slice(0, LIMITS.experience)
    .map((entry) => {
      const headers = entry.header.filter(Boolean)
      const description = entry.description.join('\n').slice(0, LIMITS.description)
      const { role, company } = assignRoleAndCompany(headers)

      if (isInternship) {
        const dates = entry.dates
          ? `${entry.dates.start}${entry.dates.end ? ` - ${entry.dates.end}` : ''}`
          : ''
        return { company, role: role || headers[0] || '', duration: dates, description }
      }

      return {
        company,
        jobTitle: role || headers[0] || '',
        location: entry.location,
        startDate: entry.dates ? entry.dates.start : '',
        endDate: entry.dates ? entry.dates.end : '',
        responsibilities: description,
      }
    })
    .filter((entry) => Object.values(entry).some((value) => typeof value === 'string' && value.trim()))
}

// ------------------------------------------------------------------ projects

// A technology list is recognised from list shape or from an explicit label,
// never from a single known technology. Those words also occur inside ordinary
// sentences ("Developed a Java-based inventory system") and inside project titles
// ("Java Inventory System"), so on their own they say nothing about the line.
function looksLikeTechList(line) {
  if (!line || line.length > 90) return false
  // "Technologies: React" is a list of one, and the label is the evidence.
  if (TECH_LABEL_HEAD.test(line)) return true
  const items = line.split(',').map((item) => item.trim()).filter(Boolean)
  return items.length >= 2 && items.length <= 10 && items.every((item) => item.split(/\s+/).length <= 3)
}

// The values on their own: "Technologies: Java, MySQL" -> "Java, MySQL".
function techListValues(line) {
  const labelled = line.match(TECH_LABEL_HEAD)
  return (labelled ? labelled[1] : line).trim()
}

function parseProjects(lines) {
  const entries = []
  let current = null

  for (const raw of lines) {
    const parts = splitOnPipes(raw)
    // "Tech Stack: Python | Pandas | NumPy" is one value split across columns.
    // The label is what says the segments belong together, so they are rejoined
    // before anything else inspects them.
    const segments = parts.length > 1 && TECH_LABEL_HEAD.test(parts[0]) ? [parts.join(' | ')] : parts

    for (const part of segments) {
      const line = stripBullet(part)
      if (!line) continue

      // A line holding nothing but a URL is the link of the project being read,
      // so it is attached before any boundary is considered. Treating it as a
      // new entry instead would both invent a project title and drag the real
      // next title into that entry's description.
      const url = line.match(ANY_URL)
      const isLinkOnly = Boolean(url) && !line.replace(url[0], '').trim()
      if (url && isLinkOnly) {
        if (!current) {
          current = { title: '', technologies: '', description: [], link: '' }
          entries.push(current)
        }
        current.link = url[0].replace(/[),.;]+$/, '')
        continue
      }

      // A new project starts on a short, non-bullet, header-shaped line once the
      // current project already holds a description or a tech stack. A link no
      // longer blocks it: links usually trail the project they belong to.
      const startsNew =
        Boolean(current) &&
        current.title &&
        isHeaderLine(raw) &&
        !/[.]$/.test(line) &&
        // "React, Node.js, PostgreSQL" belongs to the project above it.
        !looksLikeTechList(line) &&
        (current.description.length > 0 || current.technologies)

      if (!current || startsNew) {
        current = { title: '', technologies: '', description: [], link: '' }
        entries.push(current)
      }

      if (url && !/linkedin\.com|github\.com/i.test(url[0])) {
        current.link = url[0].replace(/[),.;]+$/, '')
        continue
      }

      // The title keeps its slot first. A header-shaped line is the project's
      // name even when it names a technology ("Java Inventory System"), ends in
      // a stack word ("Student Analytics Tool", "College Management System") or
      // is otherwise wordy, so no technology reading below can take it over.
      // A line that introduces its own values is never a title: those values
      // belong to the project being read.
      if (!current.title && isHeaderLine(raw) && !TECH_LABEL_HEAD.test(line)) {
        current.title = line
        continue
      }

      const label = line.match(TECH_LABEL)
      if (label) {
        const values = line.slice(label.index).replace(/^[^\w]*/, '').split(/[:,]/).slice(1).join(',').trim()
        const cleaned = values || line.replace(TECH_LABEL, '').replace(/^[\s:,-]+/, '').trim()
        if (cleaned) current.technologies = current.technologies ? `${current.technologies}, ${cleaned}` : cleaned
        continue
      }

      // A short, list-like line straight after the title is the tech stack.
      if (current.title && !current.technologies && !current.link && isHeaderLine(raw) && looksLikeTechList(line)) {
        current.technologies = techListValues(line)
        continue
      }

      current.description.push(line)
    }
  }

  return entries
    .filter((entry) => entry.title || entry.description.length)
    .slice(0, LIMITS.projects)
    .map((entry) => ({
      title: entry.title,
      technologies: entry.technologies,
      description: entry.description.join('\n').slice(0, LIMITS.description),
      link: entry.link,
    }))
}

// ---------------------------------------------------------------- entry point

function firstHeadingIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (matchHeading(lines[i])) return i
  }
  return lines.length
}

function pickResumeType(sections, requested) {
  if (requested === 'fresher' || requested === 'experienced') return requested
  const filled = (key) => sections.some((item) => item.key === key && item.lines.some((line) => stripBullet(line)))
  const hasWork = filled('experience')
  const hasInternship = filled('internship')
  if (hasWork && !hasInternship) return 'experienced'
  if (hasInternship && !hasWork) return 'fresher'
  return hasWork ? 'experienced' : 'fresher'
}

function toInternshipEntry(entry) {
  return {
    company: entry.company || '',
    role: entry.jobTitle || '',
    duration: [entry.startDate, entry.endDate].filter(Boolean).join(' - '),
    description: entry.responsibilities || '',
  }
}

const SECTION_LABELS = {
  summary: 'career objective',
  education: 'education',
  skills: 'skills',
  languages: 'languages',
  projects: 'projects',
  certifications: 'certifications',
  achievements: 'achievements',
  experience: 'work experience',
}

// A file with less text than this cannot hold a resume, so it is worth
// rejecting before the AI round trip rather than paying for an API call that
// cannot find anything. The bar is deliberately low: a real resume clears it by
// a wide margin, so this only catches a blank or near-empty upload.
const MIN_SUBSTANTIAL_TEXT_WORDS = 15

/**
 * Reports whether extracted text carries enough words that a resume might be
 * inside it. Used only to decide whether an AI second opinion is worth asking
 * for: text this thin plus a thin on-device parse means there is nothing to
 * recover.
 *
 * @param {string} text Plain text extracted from a PDF or DOCX resume.
 * @returns {boolean}
 */
export function hasSubstantialResumeText(text) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return words.length >= MIN_SUBSTANTIAL_TEXT_WORDS
}

/**
 * Parses extracted resume text into ResumeBuilder form data.
 *
 * @param {string} text Plain text extracted from a PDF or DOCX resume.
 * @param {{ resumeType?: 'fresher'|'experienced' }} [options]
 * @returns {{ formData: object, warnings: string[], detectedSections: string[], missingSections: string[], resumeType: 'fresher'|'experienced' }}
 */
export function parseResumeTextToFormData(text, options = {}) {
  const lines = toLines(text)
  const warnings = []

  const contacts = collectContacts(lines)
  const sections = detectSections(lines)
  const headerLines = lines.slice(0, firstHeadingIndex(lines))

  const fullName = detectName(headerLines, lines)
  const personalInfo = {
    fullName,
    email: contacts.email,
    phone: contacts.phone,
    location: detectLocation(headerLines, fullName),
    linkedin: contacts.linkedin,
    github: contacts.github,
    portfolio: contacts.portfolio,
  }

  const resumeType = pickResumeType(sections, options.resumeType)
  const section = (key) => sections.find((item) => item.key === key)
  const linesOf = (key) => (section(key) ? section(key).lines : [])

  // Not every resume labels its opening paragraph. With no summary heading the
  // header is used instead, minus the name and the contact block, so the
  // objective still gets read without the contact details leaking into it.
  const summary = parseSummary(section('summary') ? section('summary').lines : headerLines, fullName)
  const education = parseEducation(linesOf('education'))
  const skills = parseSkills(linesOf('skills'))
  const languages = parseLanguages(linesOf('languages'))
  const projects = parseProjects(linesOf('projects'))
  const certifications = parseNameList(linesOf('certifications'), 'certifications')
  const achievements = parseNameList(linesOf('achievements'), 'achievements')
  const workExperience = parseExperience(linesOf('experience'), 'work')
  const internship = parseExperience(linesOf('internship'), 'internship')

  // Internships filed under a generic "Experience" heading still belong in the
  // internship list, so they are not lost when a resume mixes both.
  const isInternshipRole = (entry) => /\bintern\b|\btrainee\b/i.test(entry.jobTitle || '')
  const realWork = workExperience.filter((entry) => !isInternshipRole(entry))

  const formData = {
    personalInfo,
    careerObjective: resumeType === 'fresher' ? summary : '',
    professionalSummary: resumeType === 'experienced' ? summary : '',
    education,
    skills,
    languages,
    projects,
    certifications,
    achievements,
    internship: resumeType === 'fresher'
      ? [...internship, ...workExperience.filter(isInternshipRole).map(toInternshipEntry)]
      : internship,
    // Everything filed under the WORK EXPERIENCE heading stays there. Only a
    // fresher resume moves intern-titled entries into the internship list;
    // dropping them from an experienced resume would lose a whole entry.
    workExperience: resumeType === 'experienced'
      ? workExperience
      : realWork.filter((entry) => isInternshipRole(entry)),
  }

  const detectedSections = sections.map((item) => item.key)
  const counts = {
    summary: summary ? 1 : 0,
    education: education.length,
    skills: skills.length,
    languages: languages.length,
    projects: projects.length,
    certifications: certifications.length,
    achievements: achievements.length,
    experience: formData.internship.length + formData.workExperience.length,
  }

  const missingSections = Object.keys(counts).filter((key) => counts[key] === 0)
  for (const key of missingSections) {
    const label = key === 'summary' && resumeType === 'fresher' ? 'career objective' : SECTION_LABELS[key]
    warnings.push(`No ${label} was detected in the file.`)
  }
  if (!personalInfo.fullName) warnings.push('The candidate name could not be identified.')
  if (!personalInfo.email) warnings.push('No email address was detected.')
  if (missingSections.length >= 6) {
    warnings.push('Very little structured content was recognised. You may need to fill most fields by hand.')
  }

  return { formData, warnings, detectedSections, missingSections, resumeType }
}

export { toLines, stripBullet, detectSections, collectContacts }
export default parseResumeTextToFormData