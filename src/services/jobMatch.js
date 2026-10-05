import { TECHNICAL_KEYWORDS, matchJobDescription } from './atsScore'

// Job Description Matcher analysis.
//
// This is deliberately NOT a second ATS algorithm. services/atsScore.js is the
// single source of truth for resume scoring and keyword extraction, and it is
// imported here rather than reimplemented:
//
//   - matchJobDescription() supplies the keyword sets and the raw keyword
//     coverage ratio, exactly as the in-editor ATS panel uses them.
//   - TECHNICAL_KEYWORDS is the same vocabulary the ATS skill scoring uses, so a
//     "matching skill" here means precisely the same thing it means there.
//
// What this module adds on top is presentation-shaped derivation the ATS panel
// does not need: separating skills from generic keywords, ranking experience
// against the job, and turning that into a Job Match Score. The Job Match Score
// answers "how well does this resume fit this one job", while the ATS Resume
// Score answers "how well will a parser read this resume". They are different
// questions and neither one substitutes for the other.

// ---------------------------------------------------------------------------
// Skills vocabulary
// ---------------------------------------------------------------------------

// TECHNICAL_KEYWORDS is the ATS engine's list. A job description routinely asks
// for tools that list does not carry (Docker, Kubernetes, Kafka, and so on), so
// the matcher works from a superset. Every entry still goes through the same
// word-boundary test the ATS engine uses, so "aws" cannot match "laws" and "vue"
// cannot match "avenue".
//
// Display aliases let the UI show a familiar casing/brand spelling ("node.js" ->
// "Node.js") while the matching itself stays on the lowercase catalogue key.
const SKILL_ALIASES = {
  'node.js': 'Node.js',
  'next.js': 'Next.js',
  'ci/cd': 'CI/CD',
  'power bi': 'Power BI',
  'nlp': 'NLP',
  'rest': 'REST API',
  api: 'API',
  aws: 'AWS',
  gcp: 'GCP',
  css: 'CSS',
  html: 'HTML',
  sql: 'SQL',
  ios: 'iOS',
  php: 'PHP',
  rpa: 'RPA',
  seo: 'SEO',
  ui: 'UI',
  ux: 'UX',
  ml: 'Machine Learning',
  llm: 'LLM',
  'c#': 'C#',
  'c++': 'C++',
  'ai/ml': 'AI/ML',
  ai: 'AI',
  etl: 'ETL',
  elt: 'ELT',
  dbt: 'dbt',
  sdlc: 'SDLC',
  qa: 'QA',
  'a/b': 'A/B Testing',
  ec2: 'EC2',
  s3: 'S3',
  rds: 'RDS',
  'scikit-learn': 'scikit-learn',
  // Deliberately not an acronym skill: "n/a" in a resume is filler, not a skill.
  'n/a': '',
}

// Cloud, data-platform, tooling and process skills that a job description asks
// for but the ATS list does not score.
const EXTRA_SKILLS = [
  'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'circleci',
  'github actions', 'grafana', 'prometheus', 'kafka', 'rabbitmq', 'spark',
  'hadoop', 'hive', 'snowflake', 'redshift', 'bigquery', 'airflow', 'dbt',
  'etl', 'nosql', 'dynamodb', 's3', 'lambda', 'ec2', 'rds', 'cloudfront',
  'openstack', 'vmware', 'netlify', 'cloudflare', 'heroku', 'digitalocean',
  'linux', 'unix', 'bash', 'shell', 'git', 'bitbucket', 'postman',
  'jest', 'cypress', 'playwright', 'selenium', 'storybook', 'redux',
  'webpack', 'babel', 'vite', 'eslint', 'npm', 'yarn', 'pnpm',
  'mongodb', 'mysql', 'postgresql', 'sqlite', 'oracle', 'sql server',
  'redis', 'elasticsearch', 'cassandra', 'dynamo',
  'python', 'java', 'javascript', 'typescript', 'c', 'c#', 'c++', 'cpp', 'ruby', 'php',
  'scala', 'golang', 'rust', 'matlab', 'r', 'perl', 'kotlin', 'swift',
  'dart', 'flutter', 'react native', 'react', 'angular', 'vue', 'svelte',
  'next.js', 'node.js', 'express', 'django', 'flask', 'fastapi', 'spring',
  'spring boot', 'rails', 'laravel', '.net', 'dotnet', 'graphql', 'rest',
  'api', 'microservices', 'serverless', 'websockets',
  'html', 'css', 'sass', 'scss', 'tailwind', 'bootstrap', 'tailwindwind',
  'tailwind css', 'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
  'canva', 'framer',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras',
  'scikit-learn', 'pandas', 'numpy', 'matplotlib', 'seaborn', 'opencv',
  'nlp', 'llm', 'computer vision', 'data analysis', 'data science',
  'data engineering', 'data modeling', 'power bi', 'tableau', 'looker',
  'excel', 'google analytics', 'a/b testing', 'statistics', 'r',
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'atlassian', 'sdlc',
  'microservices', 'ci/cd', 'devops', 'aws', 'azure', 'gcp', 'firebase',
  'supabase', 'vercel', 'netlify', 'git', 'github', 'gitlab',
  'leadership', 'mentoring', 'communication', 'collaboration',
  'project management', 'stakeholder management', 'product management',
  'technical writing', 'documentation', 'problem solving', 'critical thinking',
]

// Categorised so the UI can group the skill chips and so "what kind of thing am
// I missing" is answerable at a glance. The category is a presentation label
// only; it never influences the score.
const SKILL_CATEGORIES = {
  Languages: ['python', 'java', 'javascript', 'typescript', 'c', 'c#', 'c++', 'cpp', 'golang', 'rust', 'ruby', 'php', 'scala', 'kotlin', 'swift', 'dart', 'matlab', 'r', 'perl', 'scala', 'sql', 'html', 'css'],
  'Frameworks & Libraries': ['react', 'angular', 'vue', 'svelte', 'next.js', 'node.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'spring boot', 'rails', 'laravel', '.net', 'dotnet', 'react native', 'flutter', 'tailwind', 'tailwind css', 'bootstrap', 'sass', 'scss'],
  'Data & Analytics': ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy', 'matplotlib', 'seaborn', 'opencv', 'nlp', 'llm', 'computer vision', 'data analysis', 'data science', 'data engineering', 'data modeling', 'power bi', 'tableau', 'looker', 'excel', 'statistics', 'a/b testing', 'google analytics'],
  'Cloud & Infrastructure': ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'circleci', 'github actions', 'devops', 'ci/cd', 'lambda', 'ec2', 's3', 'rds', 'cloudfront', 'dynamodb', 'cloudflare', 'netlify', 'heroku', 'vercel', 'digitalocean', 'openstack', 'vmware'],
  'Databases': ['mysql', 'postgresql', 'sqlite', 'oracle', 'sql server', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamo', 'dynamodb', 'nosql', 'snowflake', 'redshift', 'bigquery'],
  'Data Pipelines & Streaming': ['kafka', 'rabbitmq', 'spark', 'hadoop', 'hive', 'airflow', 'dbt', 'etl'],
  'Tools & Practices': ['git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'atlassian', 'agile', 'scrum', 'kanban', 'sdlc', 'postman', 'jest', 'cypress', 'playwright', 'selenium', 'storybook', 'webpack', 'vite', 'babel', 'eslint', 'npm', 'yarn', 'pnpm', 'bash', 'shell', 'linux', 'unix', 'figma', 'sketch', 'framer', 'canva'],
  'APIs & Architecture': ['api', 'rest', 'graphql', 'microservices', 'serverless', 'websockets'],
  'Soft Skills': ['leadership', 'mentoring', 'communication', 'collaboration', 'project management', 'stakeholder management', 'product management', 'technical writing', 'documentation', 'problem solving', 'critical thinking'],
}

const SKILL_TO_CATEGORY = new Map()
Object.entries(SKILL_CATEGORIES).forEach(([category, skills]) => {
  skills.forEach((skill) => {
    if (!SKILL_TO_CATEGORY.has(skill)) SKILL_TO_CATEGORY.set(skill, category)
  })
})

// The union of both vocabularies, longest-first so a multi-word skill is tested
// before its own prefix ("machine learning" before "machine" if it ever appeared
// alone) and the set is deterministic.
const SKILL_VOCABULARY = [
  ...new Set([...TECHNICAL_KEYWORDS, ...EXTRA_SKILLS]),
]
  .filter(Boolean)
  .sort((a, b) => b.length - a.length || a.localeCompare(b))

// ---------------------------------------------------------------------------
// Word-boundary matching (same rule the ATS engine applies)
// ---------------------------------------------------------------------------

const matcherCache = new Map()

function hasTerm(text, term) {
  if (!term) return false
  const cacheKey = term.toLowerCase()
  let pattern = matcherCache.get(cacheKey)
  if (!pattern) {
    const escaped = cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // A one-character term needs a stricter closing boundary. "C" and "C++" are
    // separate catalogue entries and a posting that only ever says "C++" is not
    // evidence of plain C, so the trailing lookahead also rejects "+", "#" and
    // "&". Without that, "C++" reported the skill C and "R&D" reported R.
    const closing = cacheKey.length === 1 ? '(?![A-Za-z0-9+#&])' : '(?![A-Za-z0-9])'
    pattern = new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:e?s|d|ed|ing)?${closing}`, 'i')
    matcherCache.set(cacheKey, pattern)
  }
  return pattern.test(text)
}

// ---------------------------------------------------------------------------
// Resume text extraction
// ---------------------------------------------------------------------------

function safeStr(value) {
  return value == null ? '' : String(value).trim()
}

function asEntryList(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    : []
}

// Flattens the stored resume into one searchable blob. Mirrors the field
// coverage the ATS engine uses so a skill counts here exactly when it counts
// there, and every list is normalised first: a stored array can legitimately
// hold null or a primitive where an entry object belongs.
function buildResumeText(formData, resumeType) {
  const fd = formData || {}
  const isFresher = resumeType === 'fresher'
  const experiences = isFresher ? fd.internship : fd.workExperience
  const expTextKey = isFresher ? 'description' : 'responsibilities'

  return [
    safeStr(fd.careerObjective),
    safeStr(fd.professionalSummary),
    ...asEntryList(fd.education).map(
      (e) => `${e.degree} ${e.department} ${e.college} ${e.university} ${e.cgpa}`,
    ),
    ...(Array.isArray(fd.skills) ? fd.skills.map(safeStr) : []),
    ...asEntryList(fd.projects).map((p) => `${p.title} ${p.description} ${p.technologies}`),
    ...asEntryList(experiences).map((e) => `${e.jobTitle} ${e.role} ${e.company} ${e[expTextKey]}`),
    ...asEntryList(fd.certifications).map((c) => c.name),
    ...asEntryList(fd.achievements).map((a) => a.name),
    ...asEntryList(fd.languages).map((l) => (typeof l === 'string' ? l : l && l.name)),
  ]
    .filter(Boolean)
    .join(' ')
}

// Experience entries on their own, kept separate so each role can be matched
// against the job independently rather than as one anonymous blob.
function experienceEntries(formData, resumeType) {
  const fd = formData || {}
  const isFresher = resumeType === 'fresher'
  const list = isFresher ? fd.internship : fd.workExperience
  const expTextKey = isFresher ? 'description' : 'responsibilities'

  return asEntryList(list)
    .map((entry) => {
      const title = safeStr(entry.jobTitle || entry.role) || 'Role'
      const company = safeStr(entry.company)
      const body = safeStr(entry[expTextKey])
      const label = company ? `${title} at ${company}` : title
      return {
        label,
        title,
        company,
        text: `${title} ${company} ${body}`,
      }
    })
    .filter((entry) => entry.text.trim().length > 0)
}

// ---------------------------------------------------------------------------
// Skills present in a body of text
// ---------------------------------------------------------------------------

function extractSkills(text) {
  if (!safeStr(text)) return []
  const body = safeStr(text)
  return SKILL_VOCABULARY.filter((skill) => hasTerm(body, skill))
}

function displayName(skill) {
  if (Object.prototype.hasOwnProperty.call(SKILL_ALIASES, skill)) {
    return SKILL_ALIASES[skill] || skill
  }
  // Sentence case for everything else so "SKILLS" and "Agile" do not both look
  // shouty, while still capitalising known acronyms via the alias table.
  return skill.charAt(0).toUpperCase() + skill.slice(1)
}

function categoryOf(skill) {
  return SKILL_TO_CATEGORY.get(skill) || 'Other'
}

function dedupe(values) {
  const seen = new Set()
  const out = []
  values.forEach((value) => {
    const key = safeStr(value).toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(value)
  })
  return out
}

// ---------------------------------------------------------------------------
// Keyword cleanup
// ---------------------------------------------------------------------------

// The ATS engine already strips its own stop words and 2-character fragments
// inside buildJobKeywords(). These are the *additional* words that survive that
// pass but are still noise in a match report ("experience", "team", "work" and
// friends, which its stop list intentionally keeps because the ATS skill
// scoring depends on some of them).
const REPORT_STOP_WORDS = new Set([
  'experience', 'experienced', 'work', 'working', 'team', 'teams', 'role',
  'candidate', 'candidates', 'job', 'jobs', 'position', 'company', 'companies',
  'workplace', 'ability', 'abilities', 'knowledge', 'understanding', 'skills',
  'skill', 'requirements', 'requirement', 'responsibilities', 'qualifications',
  'qualification', 'looking', 'join', 'joining', 'apply', 'application',
  'applications', 'benefits', 'salary', 'please', 'will', 'well', 'good',
  'great', 'new', 'use', 'using', 'used', 'help', 'helps', 'support',
  'includes', 'include', 'including', 'etc', 'via', 'within', 'across',
  'plus', 'must', 'should', 'would', 'could', 'may', 'one', 'two', 'three',
  'first', 'second', 'newer', 'them', 'their', 'they', 'have', 'has', 'had',
  'who', 'which', 'what', 'when', 'where', 'how', 'why', 'all', 'any', 'our',
  'you', 'your', 'we', 'us', 'not', 'but', 'are', 'was', 'were', 'been',
  'being', 'than', 'then', 'there', 'here', 'also', 'more', 'most', 'much',
  'many', 'other', 'such', 'only', 'just', 'very', 'really', 'about', 'into',
  'over', 'per', 'own', 'same', 'each', 'every', 'both', 'few', 'less',
  'least', 'since', 'until', 'while', 'where', 'able', 'need', 'want',
  'ideal', 'preferably', 'required', 'must-have', 'nice', 'have', 'has',
  'least', 'minimum', 'years', 'year', 'month', 'months', 'day', 'days',
])

// A keyword worth reporting to a candidate: at least 3 characters, not a stop
// word, and not a bare number (dates, percentages and "3+ years" carry no signal).
function isMeaningfulKeyword(keyword) {
  const value = safeStr(keyword)
  if (value.length < 3) return false
  if (REPORT_STOP_WORDS.has(value.toLowerCase())) return false
  if (/^\d+$/.test(value)) return false
  if (/^\d+(\.\d+)?%?$/.test(value)) return false
  return /[a-z]/i.test(value)
}

function cleanKeywords(list) {
  return dedupe((Array.isArray(list) ? list : []).map(safeStr).filter(isMeaningfulKeyword))
}

// ---------------------------------------------------------------------------
// Experience matching
// ---------------------------------------------------------------------------

// Groups a job description's requirements into readable capability areas so the
// report reads like "Python Development ✓ / Cloud Deployment ⚠" instead of a
// raw keyword dump. Each area lists its trigger terms; an area is only reported
// when the job description actually mentions it, so no area can be invented.
const CAPABILITY_AREAS = [
  { label: 'Data Analysis', terms: ['data analysis', 'data analytics', 'analytics', 'reporting', 'dashboards', 'insights', 'kpi', 'metrics'] },
  { label: 'Machine Learning', terms: ['machine learning', 'ml', 'deep learning', 'model', 'modeling', 'prediction', 'predictive', 'nlp', 'llm'] },
  { label: 'Web Development', terms: ['web', 'frontend', 'front-end', 'backend', 'back-end', 'full stack', 'full-stack', 'react', 'angular', 'vue', 'ui', 'ux'] },
  { label: 'Cloud Deployment', terms: ['cloud', 'deployment', 'deploy', 'infrastructure', 'devops', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'ci/cd', 'cicd'] },
  { label: 'API & Integration', terms: ['api', 'apis', 'rest', 'graphql', 'integration', 'integrations', 'microservices', 'web services', 'third-party'] },
  { label: 'Database & Storage', terms: ['database', 'databases', 'sql', 'nosql', 'data modeling', 'schema', 'etl', 'warehouse', 'pipeline'] },
  { label: 'Testing & Quality', terms: ['testing', 'test', 'tests', 'qa', 'unit testing', 'automation', 'quality assurance', 'tdd'] },
  { label: 'Agile Delivery', terms: ['agile', 'scrum', 'kanban', 'sprint', 'iterative'] },
  { label: 'Team Leadership', terms: ['leadership', 'lead', 'mentor', 'mentoring', 'manage', 'managing', 'management', 'supervise'] },
  { label: 'Communication', terms: ['communication', 'communicate', 'stakeholder', 'presentation', 'documentation', 'collaboration'] },
  { label: 'Version Control', terms: ['git', 'github', 'gitlab', 'version control', 'repository'] },
  { label: 'Performance Optimization', terms: ['performance', 'optimization', 'optimisation', 'optimize', 'optimise', 'scalability', 'scalable', 'latency', 'throughput', 'efficiency'] },
]

function matchExperience(entries, jobSkills, jobDescription) {
  const jd = safeStr(jobDescription).toLowerCase()

  // Only areas the job actually raises are considered.
  const demanded = CAPABILITY_AREAS.filter((area) => area.terms.some((term) => hasTerm(jd, term)))
  if (!demanded.length) return []

  return demanded.map((area) => {
    // An area counts as covered when some experience entry's own text covers it,
    // or when a demanded job skill for that area appears anywhere in the resume's
    // experience text. Nothing is claimed that the resume does not contain.
    const coveredByEntry = entries.filter((entry) => area.terms.some((term) => hasTerm(entry.text, term)))
    const relatedSkills = jobSkills.filter((skill) => area.terms.some((term) => hasTerm(skill, term)))
    const coveredSkills = relatedSkills.filter((skill) => entries.some((entry) => hasTerm(entry.text, skill)))
    const covered = coveredByEntry.length > 0

    return {
      label: area.label,
      covered,
      evidence: coveredByEntry.slice(0, 2).map((entry) => entry.label),
      skills: dedupe(coveredSkills.map(displayName)).slice(0, 5),
    }
  })
}

// ---------------------------------------------------------------------------
// Job Match Score
// ---------------------------------------------------------------------------

// Weighted blend of three measured coverages. Weights are fixed and documented
// rather than tuned per job so the same resume against two different postings is
// scored on the same basis. Skills carry the most weight because they are what
// an ATS filter screens on; keywords come next; experience support is the
// smallest share because a resume with no experience section is not necessarily
// a bad match, just an unproven one.
//
// The result is always derived from the counts below. Nothing here can produce a
// number without a job description and a resume to compare, so there is no code
// path that returns a hardcoded or random score.
const WEIGHTS = { skills: 0.5, keywords: 0.3, experience: 0.2 }

function matchLabel(percent) {
  if (percent >= 80) return 'Strong Match'
  if (percent >= 60) return 'Good Match'
  if (percent >= 40) return 'Partial Match'
  return 'Low Match'
}

function roundPercent(value) {
  return Math.round(Math.min(100, Math.max(0, value)))
}

function groupSkillsByCategory(skills) {
  const groups = new Map()
  skills.forEach((skill) => {
    const category = categoryOf(skill.key)
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category).push(displayName(skill.key))
  })
  return [...groups.entries()].map(([category, items]) => ({ category, items: dedupe(items) }))
}

/**
 * Compares one stored resume against one job description.
 *
 * @param {object} formData The resume's stored form data.
 * @param {'fresher'|'experienced'} resumeType
 * @param {string} jobDescription
 * @returns {object} Analysis result. `score` is null when there is not enough
 *   data to compare, so the UI can say so instead of showing a number.
 */
export function analyzeJobMatch(formData, resumeType, jobDescription) {
  const jd = safeStr(jobDescription)
  const empty = {
    score: null,
    label: '',
    hasJobData: false,
    atsScore: null,
    counts: { jobSkills: 0, matchedSkills: 0, missingSkills: 0, jobKeywords: 0, matchedKeywords: 0, missingKeywords: 0 },
    coverages: { skills: 0, keywords: 0, experience: 0 },
    matchedSkills: [],
    missingSkills: [],
    matchedSkillsByCategory: [],
    missingSkillsByCategory: [],
    matchedKeywords: [],
    missingKeywords: [],
    experience: [],
    experienceGaps: [],
  }

  if (!formData || typeof formData !== 'object' || !jd) return empty

  const type = resumeType === 'experienced' ? 'experienced' : 'fresher'
  const resumeText = buildResumeText(formData, type)
  const entries = experienceEntries(formData, type)

  // Reuse the ATS engine's keyword extraction so the two reports agree on what
  // counts as a keyword. Its matched/missing lists are the report's keywords.
  const keywordMatch = matchJobDescription(formData, type, jd)

  const jobSkills = extractSkills(jd)
  const matchedSkillKeys = jobSkills.filter((skill) => hasTerm(resumeText, skill))
  const missingSkillKeys = jobSkills.filter((skill) => !hasTerm(resumeText, skill))

  // The keyword lists come straight out of the shared engine, then get the
  // report-level stop-word filter so "experience"/"team"/"work" never appear as
  // something the candidate is "missing".
  const matchedKeywords = cleanKeywords(keywordMatch.matched)
  const missingKeywords = cleanKeywords(keywordMatch.missing)

  const experience = matchExperience(entries, jobSkills, jd)
  const coveredAreas = experience.filter((area) => area.covered).length
  const experienceGaps = experience.filter((area) => !area.covered).map((area) => area.label)

  const jobKeywordTotal = matchedKeywords.length + missingKeywords.length

  // Nothing to compare against: a job description with no recognisable skills
  // and no usable keywords cannot produce a score.
  if (!jobSkills.length && !jobKeywordTotal) {
    return { ...empty, hasJobData: false }
  }

  const skillCoverage = jobSkills.length ? matchedSkillKeys.length / jobSkills.length : 0
  const keywordCoverage = jobKeywordTotal ? matchedKeywords.length / jobKeywordTotal : 0
  // With no experience section the resume is unproven, not proven-wrong, so an
  // empty experience list scores neutral rather than zero.
  const experienceCoverage = experience.length ? coveredAreas / experience.length : 0.5

  const blended =
    WEIGHTS.skills * skillCoverage +
    WEIGHTS.keywords * keywordCoverage +
    WEIGHTS.experience * experienceCoverage

  const score = roundPercent(blended * 100)

  return {
    score,
    label: matchLabel(score),
    hasJobData: true,
    coverages: {
      skills: roundPercent(skillCoverage * 100),
      keywords: roundPercent(keywordCoverage * 100),
      experience: experience.length ? roundPercent(experienceCoverage * 100) : null,
    },
    counts: {
      jobSkills: jobSkills.length,
      matchedSkills: matchedSkillKeys.length,
      missingSkills: missingSkillKeys.length,
      jobKeywords: jobKeywordTotal,
      matchedKeywords: matchedKeywords.length,
      missingKeywords: missingKeywords.length,
    },
    matchedSkills: dedupe(matchedSkillKeys.map(displayName)),
    missingSkills: dedupe(missingSkillKeys.map(displayName)),
    matchedSkillsByCategory: groupSkillsByCategory(matchedSkillKeys.map((key) => ({ key }))),
    missingSkillsByCategory: groupSkillsByCategory(missingSkillKeys.map((key) => ({ key }))),
    matchedKeywords,
    missingKeywords,
    experience,
    experienceGaps,
  }
}

/**
 * Flattens an analysis into the compact shape sent to Gemini. Only the
 * candidate's own resume-derived findings are included; the job description is
 * sent separately by the caller.
 */
export function buildSkillGapPayload(analysis) {
  if (!analysis || !analysis.hasJobData) return null
  return {
    matchedSkills: analysis.matchedSkills.slice(0, 40),
    missingSkills: analysis.missingSkills.slice(0, 40),
    matchedKeywords: analysis.matchedKeywords.slice(0, 40),
    missingKeywords: analysis.missingKeywords.slice(0, 40),
    experienceGaps: analysis.experienceGaps.slice(0, 10),
    jobMatchScore: analysis.score,
  }
}

export const MIN_JOB_DESCRIPTION_LENGTH = 80
export const MAX_JOB_DESCRIPTION_LENGTH = 20000

/**
 * Validates the job description before any analysis runs.
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateJobDescription(value) {
  const jd = safeStr(value)
  if (!jd) {
    return { ok: false, error: 'Please enter a job description before analyzing.' }
  }
  if (jd.length < MIN_JOB_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Please paste the full job description. At least ${MIN_JOB_DESCRIPTION_LENGTH} characters are needed for an accurate analysis.`,
    }
  }
  if (jd.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `This job description is too long. Only the first ${MAX_JOB_DESCRIPTION_LENGTH} characters can be analyzed.`,
    }
  }
  return { ok: true }
}

export default analyzeJobMatch