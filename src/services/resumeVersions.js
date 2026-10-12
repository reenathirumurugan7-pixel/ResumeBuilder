import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb, getAuthInstance, firebaseConfigured } from '../firebase'

// ---------------------------------------------------------------------------
// Resume version history
//
// A version is an immutable snapshot the user saved deliberately (never an
// autosave, keystroke or AI action). Snapshots live in a subcollection of the
// resume they belong to:
//
//   resumes/{resumeId}/versions/{versionId}
//
// The parent resume document is never touched by this module, so the existing
// save/autosave flow, the Vault, metrics and visibility rules keep working
// exactly as before.
//
// Snapshot contents are limited to resume data (form fields + template config).
// No tokens, credentials or keys are ever stored.
// ---------------------------------------------------------------------------

const RESUMES_COLLECTION = 'resumes'
const VERSIONS_COLLECTION = 'versions'

// The version id encodes the version number (`v3`), and the security rules
// refuse to overwrite an existing version, so a second writer that picked the
// same number is simply told "no" and walks to the next one. The cap keeps a
// pathological race from looping forever.
const MAX_CREATE_ATTEMPTS = 25

/** Every list-valued field of the resume schema; these must stay arrays. */
const ARRAY_FIELDS = [
  'education', 'skills', 'languages', 'projects',
  'certifications', 'achievements', 'internship', 'workExperience',
]

/** Free-text fields a textarea reads as a controlled string. */
const TEXT_FIELDS = ['careerObjective', 'professionalSummary']

/** Scalar fields the editors always read as strings. */
const INFO_FIELDS = ['fullName', 'email', 'phone', 'location', 'linkedin', 'github', 'portfolio']

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** An Error carrying a stable, machine-readable code the UI can map. */
function versionError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export function versionErrorCode(error) {
  return (error && (error.code || (error.cause && error.cause.code))) || ''
}

function signedInUserId() {
  if (!firebaseConfigured) return null
  try {
    return getAuthInstance().currentUser?.uid || null
  } catch {
    return null
  }
}

function versionsRef(resumeId) {
  return collection(getDb(), RESUMES_COLLECTION, resumeId, VERSIONS_COLLECTION)
}

/**
 * True when versions can be read or written at all: Firebase must be
 * configured and an account must be signed in, because every version rule is
 * tied to the owner's uid. Local-only (signed-out) drafts have no cloud
 * history by design.
 */
export function isVersionHistoryAvailable() {
  return firebaseConfigured && Boolean(signedInUserId())
}

/**
 * Normalises a stored snapshot before it is shown or restored.
 *
 * Returns null when the snapshot is unusable (missing or structurally wrong
 * `formData`), and otherwise guarantees the shape the editors, the live preview
 * and storage expect — arrays are arrays, text fields are strings — so a
 * tampered or truncated document can never crash the editor. Unknown fields
 * (a profile photo, a newer key) are preserved as-is.
 */
export function sanitizeVersionSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) return null
  const raw = snapshot.formData
  if (!isPlainObject(raw)) return null

  const personalInfo = isPlainObject(raw.personalInfo) ? { ...raw.personalInfo } : {}
  for (const field of INFO_FIELDS) {
    if (typeof personalInfo[field] !== 'string') personalInfo[field] = ''
  }

  const formData = { ...raw, personalInfo }
  for (const field of ARRAY_FIELDS) {
    const value = formData[field]
    formData[field] = Array.isArray(value)
      ? value.filter((entry) => typeof entry === 'string' || isPlainObject(entry))
      : []
  }
  for (const field of TEXT_FIELDS) {
    if (typeof formData[field] !== 'string') formData[field] = ''
  }

  return {
    formData,
    qrCodeEnabled: snapshot.qrCodeEnabled === true,
    config: isPlainObject(snapshot.config) ? snapshot.config : null,
  }
}

function toMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanos || 0) / 1e6)
  }
  return null
}

function fromVersionDoc(snapshot) {
  const data = snapshot.data() || {}
  const versionNumber = Number(data.versionNumber)
  return {
    id: snapshot.id,
    versionNumber: Number.isFinite(versionNumber) && versionNumber > 0 ? Math.floor(versionNumber) : 0,
    resumeId: typeof data.resumeId === 'string' ? data.resumeId : '',
    userId: typeof data.userId === 'string' ? data.userId : '',
    resumeType: data.resumeType === 'experienced' ? 'experienced' : 'fresher',
    createdAt: toMillis(data.createdAt),
    snapshot: isPlainObject(data.snapshot) ? data.snapshot : null,
  }
}

/** Newest first; version number breaks a tie so the order is always stable. */
export function compareVersionsNewestFirst(a, b) {
  const byDate = (b.createdAt || 0) - (a.createdAt || 0)
  if (byDate !== 0) return byDate
  return (b.versionNumber || 0) - (a.versionNumber || 0)
}

/**
 * Creates the next version of a resume.
 *
 * The next number is taken from the highest stored one (1 when there are no
 * versions yet) and the document id is derived from it, so numbers are
 * sequential per resume and can never be reused while a version with that
 * number still exists. The security rules only allow *creating* a version, so
 * a colliding writer is rejected instead of overwriting a stored snapshot and
 * simply retries with the following number.
 */
export async function createResumeVersion({ resumeId, resumeType, snapshot }) {
  if (!resumeId) {
    throw versionError('missing-resume', 'No resume is open, so a version cannot be created.')
  }
  if (!firebaseConfigured) {
    throw versionError('not-configured', 'Firebase is not configured, so versions cannot be saved.')
  }
  const userId = signedInUserId()
  if (!userId) {
    throw versionError('signed-out', 'You must be logged in to create a version.')
  }
  const clean = sanitizeVersionSnapshot(snapshot)
  if (!clean) {
    throw versionError('bad-snapshot', 'There is no resume data to save as a version yet.')
  }

  const type = resumeType === 'experienced' ? 'experienced' : 'fresher'
  const colRef = versionsRef(resumeId)

  const latest = await getDocs(query(colRef, orderBy('versionNumber', 'desc'), limit(1)))
  let versionNumber = 1
  if (!latest.empty) {
    const highest = Number(latest.docs[0].data().versionNumber)
    if (Number.isFinite(highest) && highest >= 1) versionNumber = Math.floor(highest) + 1
  }

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1, versionNumber += 1) {
    const ref = doc(colRef, `v${versionNumber}`)
    try {
      await setDoc(ref, {
        versionNumber,
        resumeId,
        userId,
        resumeType: type,
        createdAt: serverTimestamp(),
        snapshot: {
          formData: clean.formData,
          qrCodeEnabled: clean.qrCodeEnabled,
          config: clean.config,
        },
      })
      return { id: ref.id, versionNumber }
    } catch (err) {
      if (versionErrorCode(err) !== 'permission-denied') throw err
      // Expected only when another writer claimed this number first: the rules
      // treat overwriting an existing version as an update, and updates are
      // denied. Anything else (no access, bad payload) is a real failure.
      let taken
      try {
        taken = (await getDoc(ref)).exists()
      } catch {
        taken = false
      }
      if (!taken) throw err
    }
  }

  throw versionError('conflict', 'Several versions were created at the same time. Please try again.')
}

/** All versions of a resume, newest first. */
export async function listResumeVersions(resumeId) {
  if (!resumeId || !firebaseConfigured) return []
  const snap = await getDocs(query(versionsRef(resumeId), orderBy('createdAt', 'desc')))
  const versions = snap.docs.map(fromVersionDoc)
  versions.sort(compareVersionsNewestFirst)
  return versions
}

/** One version, or null when it has been deleted. */
export async function getResumeVersion(resumeId, versionId) {
  if (!resumeId || !versionId || !firebaseConfigured) return null
  const snap = await getDoc(doc(versionsRef(resumeId), versionId))
  return snap.exists() ? fromVersionDoc(snap) : null
}

/**
 * Deletes exactly one version document. The resume itself and every other
 * version are untouched.
 */
export async function deleteResumeVersion(resumeId, versionId) {
  if (!resumeId || !versionId) {
    throw versionError('missing-resume', 'This version can no longer be located.')
  }
  if (!firebaseConfigured) {
    throw versionError('not-configured', 'Firebase is not configured, so versions cannot be managed.')
  }
  await deleteDoc(doc(versionsRef(resumeId), versionId))
}
