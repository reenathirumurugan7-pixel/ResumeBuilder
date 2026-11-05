import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, orderBy, where, updateDoc, increment } from 'firebase/firestore'
import { getDb, getAuthInstance, firebaseConfigured } from '../firebase'

const RESUMES_KEY = 'resume_builder_resumes'
const LEGACY_RESUMES_KEY = 'resume_builder_resumes_legacy_v0'
const COLLECTION = 'resumes'

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'res_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// The name createResume() gives a resume whose form data has no full name yet.
// It is a derived value, not a label the user chose.
const UNTITLED_RESUME_NAME = 'Untitled Resume'

export function defaultResumeName(formData) {
  const name = formData && formData.personalInfo && formData.personalInfo.fullName
  if (name && name.trim()) {
    return name.trim()
  }
  return UNTITLED_RESUME_NAME
}

/**
 * True when a stored resume name is one `defaultResumeName` produced rather than
 * one the user chose.
 *
 * Two kinds of name exist and they must be treated differently. A name the user
 * typed in the Vault, or that came from an imported file, is a label on the
 * resume and has to outlive every later content edit. A name that is just
 * `defaultResumeName` output is derived from the form and has always followed
 * the full name as it was typed, so it must keep doing that.
 *
 * The placeholder counts as derived even once the form has been filled in:
 * createResume() writes it while the full name is still empty, so a stored
 * "Untitled Resume" is leftover output, not a choice.
 */
function isDerivedResumeName(name, formData) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return true
  return trimmed === UNTITLED_RESUME_NAME || trimmed === defaultResumeName(formData)
}

// ---------------------------------------------------------------------------
// localStorage namespacing
//
// The draft cache used to live under one global key, so signing into a second
// account on the same browser showed (and could overwrite) the previous
// account's drafts. Drafts are now stored per Firebase UID. Signed-out visitors
// still get a shared "guest" bucket so local-only usage keeps working, and the
// old unscoped data is quarantined instead of being deleted so no draft is lost.
// ---------------------------------------------------------------------------

function currentUid() {
  if (!firebaseConfigured) return 'guest'
  try {
    return getAuthInstance().currentUser?.uid || 'guest'
  } catch {
    return 'guest'
  }
}

function namespacedKey(uid) {
  return `${RESUMES_KEY}_${uid || 'guest'}`
}

function legacyIdKey(storedKey, uid) {
  return `${storedKey}_${uid || 'guest'}`
}

const EDITOR_RESUME_KEYS = ['fresher_resume_id', 'experienced_resume_id']

/**
 * Returns the draft the editors were last working on, or null. Used by the
 * "Resume in progress" shortcut. Reads the namespaced keys, so it can only ever
 * surface the current account's own drafts.
 */
export function getResumeInProgress() {
  quarantineLegacyData()
  const uid = currentUid()
  if (uid === 'guest') {
    // Fall back to the guest bucket so an anonymous visitor still sees their
    // own in-progress draft.
    for (const storedKey of EDITOR_RESUME_KEYS) {
      try {
        const id = localStorage.getItem(legacyIdKey(storedKey, 'guest'))
        if (id) {
          const resume = getResume(id)
          if (resume) return resume
        }
      } catch {
        /* try the next editor */
      }
    }
    return null
  }
  for (const storedKey of EDITOR_RESUME_KEYS) {
    try {
      const id = localStorage.getItem(legacyIdKey(storedKey, uid))
      if (id) {
        const resume = getResume(id)
        if (resume) return resume
      }
    } catch {
      /* storage unavailable — try the next editor */
    }
  }
  return null
}

/**
 * Points an editor at a specific resume ("open this one from the Vault").
 * Namespaced per account so the current user is always in control of their own
 * editor state.
 */
export function setEditorResumeId(storedKey, id) {
  try {
    if (id) localStorage.setItem(legacyIdKey(storedKey, currentUid()), id)
    else localStorage.removeItem(legacyIdKey(storedKey, currentUid()))
  } catch {
    /* storage unavailable — the editor simply starts fresh */
  }
}

/** Clears the pointer so the next editor visit starts a new resume. */
export function clearEditorResumeId(storedKey) {
  setEditorResumeId(storedKey, null)
}

// Moves pre-namespacing data out of the shared keys on first use so it can never
// be shown to (or overwritten by) a different account.
function quarantineLegacyData() {
  try {
    const legacy = localStorage.getItem(RESUMES_KEY)
    if (legacy) {
      if (!localStorage.getItem(LEGACY_RESUMES_KEY)) {
        localStorage.setItem(LEGACY_RESUMES_KEY, legacy)
      }
      localStorage.removeItem(RESUMES_KEY)
    }
  } catch {
    /* storage unavailable — fall back to an empty in-memory list */
  }
}

function loadAll() {
  try {
    const raw = localStorage.getItem(namespacedKey(currentUid()))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(resumes) {
  try {
    localStorage.setItem(namespacedKey(currentUid()), JSON.stringify(resumes))
  } catch (err) {
    console.warn('[resumeStorage] Could not write local draft:', err)
  }
}

// ---------------------------------------------------------------------------
// Deletion tombstones
//
// A deleted resume must not be revived by an editor that still holds its id
// (for example a second tab). The tombstone is namespaced per account, exactly
// like the drafts, and is checked before every local or cloud write. It only
// records ids, never resume content, and a genuinely new resume gets a fresh
// random id, so it can never be blocked by another resume's tombstone.
// ---------------------------------------------------------------------------

const DELETED_RESUMES_KEY = 'resume_builder_deleted_resumes'

function deletedResumesKey(uid) {
  return `${DELETED_RESUMES_KEY}_${uid || 'guest'}`
}

function readDeletedResumeIds() {
  try {
    const raw = localStorage.getItem(deletedResumesKey(currentUid()))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string' && id)
      : []
  } catch {
    return []
  }
}

function writeDeletedResumeIds(ids) {
  try {
    localStorage.setItem(deletedResumesKey(currentUid()), JSON.stringify(ids))
  } catch {
    /* storage unavailable — the in-memory write guard still cannot help */
  }
}

export function isResumeDeleted(id) {
  if (!id) return false
  return readDeletedResumeIds().includes(id)
}

function markResumeDeleted(id) {
  if (!id) return
  const ids = readDeletedResumeIds()
  if (!ids.includes(id)) writeDeletedResumeIds([...ids, id])
}

function unmarkResumeDeleted(id) {
  if (!id) return
  const ids = readDeletedResumeIds()
  if (ids.includes(id)) writeDeletedResumeIds(ids.filter((value) => value !== id))
}

// Removes one resume's local draft and clears only the editor pointers that
// still reference it. The helpers stay UID-scoped, so another account's drafts
// and pointers are never touched.
function forgetResumeLocally(id) {
  deleteResume(id)
  for (const storedKey of EDITOR_RESUME_KEYS) {
    try {
      const key = legacyIdKey(storedKey, currentUid())
      if (localStorage.getItem(key) === id) localStorage.removeItem(key)
    } catch {
      /* storage unavailable */
    }
  }
}

/**
 * Moves drafts created while signed out (and any pre-namespacing drafts, which
 * `quarantineLegacyData` set aside) into the signed-in account's bucket.
 *
 * Without this, a visitor who starts a resume anonymously and then signs in —
 * the normal path, since only signed-in users can save to the cloud — would have
 * their in-progress resume stranded in the guest bucket and appear to have lost
 * their work. Called by the editors once a user is known.
 */
export function claimGuestDrafts() {
  try {
    const uid = currentUid()
    if (!uid || uid === 'guest') return

    const userKey = namespacedKey(uid)
    const existing = JSON.parse(localStorage.getItem(userKey) || '[]')
    const mine = Array.isArray(existing) ? existing : []
    const knownIds = new Set(mine.map((r) => r && r.id).filter(Boolean))

    const candidates = []
    for (const key of [namespacedKey('guest'), LEGACY_RESUMES_KEY]) {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(parsed)) candidates.push(...parsed)
    }

    const adopted = candidates.filter((r) => r && r.id && !knownIds.has(r.id))
    if (adopted.length > 0) {
      localStorage.setItem(userKey, JSON.stringify([...adopted, ...mine]))
    }

    // Carry the "resume in progress" pointers across so opening an editor
    // resumes the same draft instead of starting a new one.
    for (const storedKey of EDITOR_RESUME_KEYS) {
      const guestPointer = localStorage.getItem(legacyIdKey(storedKey, 'guest'))
      if (!guestPointer) continue
      const userPointer = localStorage.getItem(legacyIdKey(storedKey, uid))
      if (!userPointer) localStorage.setItem(legacyIdKey(storedKey, uid), guestPointer)
    }

    // Drop the guest copies: on a shared machine the next signed-out visitor
    // should not be able to read the previous account's drafts.
    localStorage.removeItem(namespacedKey('guest'))
    localStorage.removeItem(LEGACY_RESUMES_KEY)
  } catch {
    /* storage unavailable — the account simply starts with no adopted drafts */
  }
}

export function createResume({ resumeType, formData, qrCodeEnabled = false, config = null, name = '' }) {
  const id = generateId()
  const resume = {
    id,
    resumeType,
    formData,
    qrCodeEnabled,
    config,
    // An importer that already knows the resume's name (an uploaded file name)
    // passes it in; everything else keeps the name derived from the form data.
    name: name || defaultResumeName(formData),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    views: 0,
    downloads: 0,
    qrScans: 0,
  }
  const all = loadAll()
  all.push(resume)
  saveAll(all)
  return resume
}

export function initResume({ storedKey, resumeType, defaultData, config = null }) {
  const uid = currentUid()
  quarantineLegacyData()
  const scopedIdKey = legacyIdKey(storedKey, uid)
  try {
    const storedId = localStorage.getItem(scopedIdKey)
    if (storedId) {
      if (isResumeDeleted(storedId)) {
        // The resume was deleted after this pointer was written. Drop the stale
        // pointer and fall through to a genuinely new resume instead of
        // reviving the deleted id.
        localStorage.removeItem(scopedIdKey)
      } else {
        const stored = getResume(storedId)
        if (stored) {
          return {
            id: stored.id,
            formData: stored.formData || defaultData,
            qrCodeEnabled: !!stored.qrCodeEnabled,
            config: stored.config || null,
            isNew: false,
            pendingFirestore: false,
          }
        }
        return {
          id: storedId,
          formData: defaultData,
          qrCodeEnabled: false,
          config: null,
          isNew: false,
          pendingFirestore: true,
        }
      }
    }
  } catch {
    /* ignore storage errors */
  }
  const resume = createResume({ resumeType, formData: defaultData, qrCodeEnabled: false, config })
  try {
    localStorage.setItem(scopedIdKey, resume.id)
  } catch {
    /* ignore storage errors */
  }
  return {
    id: resume.id,
    formData: defaultData,
    qrCodeEnabled: false,
    config: config || null,
    isNew: true,
    pendingFirestore: false,
  }
}

export function saveResume(id, updates) {
  if (isResumeDeleted(id)) return null
  const all = loadAll()
  const idx = all.findIndex((r) => r.id === id)
  const saved =
    idx === -1
      ? {
          id,
          ...updates,
          name: updates.name || defaultResumeName(updates.formData),
          createdAt: updates.createdAt || Date.now(),
          updatedAt: Date.now(),
          views: 0,
          downloads: 0,
          qrScans: 0,
        }
      : { ...all[idx], ...updates, id, updatedAt: Date.now() }
  if (idx === -1) {
    all.push(saved)
  } else {
    all[idx] = saved
  }
  saveAll(all)
  return saved
}

export function getResume(id) {
  if (isResumeDeleted(id)) return null
  const all = loadAll()
  return all.find((r) => r.id === id) || null
}

export function getAllResumes() {
  return loadAll()
}

export function deleteResume(id) {
  const all = loadAll()
  saveAll(all.filter((r) => r.id !== id))
}

// Stable origin used for shareable public resume links and QR codes.
const DEPLOYED_ORIGIN = 'https://resumebuilder-1ca16.web.app'

function isPrivateHost(hostname) {
  if (!hostname) return true
  const host = String(hostname).toLowerCase()
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

function resolveResumeOrigin() {
  // Explicit override wins (e.g. a LAN URL during local testing).
  const override = import.meta.env.VITE_RESUME_ORIGIN
  if (typeof override === 'string' && override.trim()) {
    return override.trim().replace(/\/+$/, '')
  }
  // Deployed hosts (web.app / custom domain) use their real origin.
  // Never emit a private/dev hostname (localhost, 127.0.0.1, LAN, Vite ports)
  // into a QR code: fall back to the deployed origin instead.
  if (typeof window !== 'undefined' && window.location && !isPrivateHost(window.location.hostname)) {
    return window.location.origin
  }
  return DEPLOYED_ORIGIN
}

export function resumeUrl(id) {
  return `${resolveResumeOrigin()}/resume/${id}`
}

// The URL encoded into QR codes. It is the ordinary public resume URL plus
// `src=qr`, which is the only thing that tells the public page a visitor
// arrived by scanning rather than by opening a pasted/copied link. Every QR
// surface (editor preview, vault, exported PDF) must use this so the scan
// tally stays trustworthy; `resumeUrl` above stays parameter-free for links.
export const QR_SOURCE_PARAM = 'qr'

export function resumeQrUrl(id) {
  return `${resumeUrl(id)}?src=${QR_SOURCE_PARAM}`
}

// ---------------------------------------------------------------------------
// Firestore (authoritative source for public QR resumes)
//
// localStorage (above) is kept only as an optional local draft/cache so the
// editor can paint instantly and preserve the resumeId across edits. The
// public /resume/:resumeId page reads exclusively from Firestore so it works
// across browsers/devices without any local data.
// ---------------------------------------------------------------------------

function firestoreDoc(id) {
  const db = getDb()
  return doc(db, COLLECTION, id)
}

// Resumes are private-by-default documents owned by a Firebase account, so every
// write needs a signed-in owner. Signed-out visitors keep using localStorage and
// Firestore calls are skipped instead of firing writes the security rules would
// reject (which produced a console error on every keystroke).
function signedInUserId() {
  if (!firebaseConfigured) return null
  try {
    return getAuthInstance().currentUser?.uid || null
  } catch {
    return null
  }
}

export function isCloudSyncEnabled() {
  return firebaseConfigured && Boolean(signedInUserId())
}

// A refused read is Firestore's answer for "there is nothing here you may see".
// The ownership rules cannot evaluate `resource` for a document that does not
// exist, because it is null, so the rule errors and the read is denied instead
// of being reported as missing. A denial therefore says nothing about ownership
// and must never be read as "this document is mine".
function isRulesDenied(err) {
  const code = err && err.code
  return code === 'permission-denied' || code === 'unauthorized'
}

/**
 * Merges a resume into Firestore.
 *
 * `isNewResume` must only be true for a resume that has never been written to
 * Firestore before. It runs the two-step create required by the security rules
 * (create private, then flip to public) and seeds the metric counters.
 *
 * Ordinary saves never send `isPublic` or the `views`/`downloads`/`qrScans`
 * counters, so editing a resume can no longer flip its visibility or reset a
 * running total. Visibility is changed through `toggleResumeVisibility`, which
 * is deliberate and explicit, and the counters only move through the dedicated
 * +1 helpers below (which the rules pin to exactly +1).
 *
 * A save also never renames a resume. The editors autosave the form on every
 * keystroke without a name, and regenerating one from the form data silently
 * reverted a Vault rename back to the candidate's full name (cloud and local
 * copies then disagreed). The name is therefore resolved in this order: an
 * explicit `data.name` from a caller that means it (Enhance Resume), then the
 * label already stored on this resume, and only then the derived default for a
 * resume that has never been given one. The local draft is a faithful mirror of
 * the document — the Vault writes a rename to both copies and
 * `resolveFreshestResume` pulls a rename made on another device back into it —
 * so it is what tells a kept label apart from leftover default output.
 */
export async function saveResumeToFirestore(id, data, { isNewResume = false } = {}) {
  if (!id) return null
  if (isResumeDeleted(id)) {
    const error = new Error('This resume was deleted and can no longer be saved.')
    error.code = 'resume-deleted'
    throw error
  }
  if (!firebaseConfigured) {
    console.warn('Firebase not configured; resume not saved to Firestore.')
    return null
  }
  const ownerId = signedInUserId()
  if (!ownerId) {
    console.warn('[resumeStorage] Signed out; resume kept locally only.')
    return null
  }

  const mirror = getResume(id)
  const storedName = mirror && typeof mirror.name === 'string' ? mirror.name.trim() : ''
  const keptName = isDerivedResumeName(storedName, mirror && mirror.formData) ? '' : storedName
  const requestedName = typeof data.name === 'string' ? data.name.trim() : ''

  const payload = {
    resumeType: data.resumeType || 'fresher',
    formData: data.formData || {},
    qrCodeEnabled: !!data.qrCodeEnabled,
    config: data.config || null,
    name: requestedName || keptName || defaultResumeName(data.formData) || 'My Resume',
    userId: ownerId,
    updatedAt: Date.now(),
  }
  if (data.createdAt) {
    payload.createdAt = data.createdAt
  }

  if (!isNewResume) {
    await setDoc(firestoreDoc(id), payload, { merge: true })
    return { ...payload, isPublic: data.isPublic }
  }

  // First write of a brand-new document. The create rule forbids creating a
  // document with isPublic true, so create it private (rule-compliant) and then
  // immediately flip it if the caller asked for a public resume. The engagement
  // counters start at zero here and are only ever moved by +1 afterwards.
  const wantsPublic = data.isPublic === true
  // Existence probe for the merge-vs-create decision. A brand-new id has no
  // document behind it, and the ownership rules refuse that read outright, so a
  // denial is treated as "nothing to merge into" and we fall through to the
  // create path below. It is deliberately NOT treated as ownership: writing over
  // a document that does exist is an update, which the rules only allow for the
  // owner, so another user's resume still fails on that write. Every other
  // failure (offline, quota, ...) is rethrown so a real fault is never mistaken
  // for an empty slot.
  let alreadyExists = false
  try {
    alreadyExists = (await getDoc(firestoreDoc(id))).exists()
  } catch (err) {
    if (!isRulesDenied(err)) throw err
  }
  if (alreadyExists) {
    // The document already exists (e.g. two saves raced, or this resume was
    // created on another device). Seeding again would push the counters back to
    // zero — which the rules reject anyway — so merge instead and leave the
    // running totals and the current visibility untouched.
    await setDoc(firestoreDoc(id), payload, { merge: true })
    return { ...payload, isPublic: data.isPublic }
  }
  await setDoc(firestoreDoc(id), {
    ...payload,
    isPublic: false,
    views: 0,
    downloads: 0,
    qrScans: 0,
    createdAt: payload.createdAt || Date.now(),
  })
  if (wantsPublic) {
    await setDoc(firestoreDoc(id), { isPublic: true, updatedAt: Date.now() }, { merge: true })
  }
  return { ...payload, isPublic: wantsPublic, views: 0, downloads: 0, qrScans: 0 }
}

export async function getResumeFromFirestore(id) {
  if (!id || isResumeDeleted(id)) return null
  if (!firebaseConfigured) {
    return null
  }
  try {
    const snap = await getDoc(firestoreDoc(id))
    if (!snap.exists()) {
      return null
    }
    return { id: snap.id, ...snap.data() }
  } catch (err) {
    // A resume that is not public is deliberately invisible to this caller, so
    // "permission-denied" is a normal answer rather than a failure. Returning
    // null keeps the public /resume/:id page working (public docs still read
    // fine) while making private docs look "not there yet" to the editors.
    if (isRulesDenied(err)) return null
    throw err
  }
}

export async function deleteResumeFromFirestore(id) {
  if (!id) return null
  if (!isCloudSyncEnabled()) {
    const error = new Error('You must be signed in to delete a resume.')
    error.code = 'not-signed-in'
    throw error
  }
  // Block writes from this tab and from other open tabs before the delete is
  // sent, so a stale editor autosave cannot recreate the document.
  markResumeDeleted(id)
  try {
    await deleteDoc(firestoreDoc(id))
  } catch (err) {
    // The document still exists, so allow saving again and let the caller
    // report the real failure instead of a false success.
    unmarkResumeDeleted(id)
    throw err
  }
  forgetResumeLocally(id)
  return true
}

// Writes the local draft (sync) and then persists to Firestore (async,
// fire-and-forget). Used by the editors so changes are both immediately
// available locally and reachable from any device via the public QR URL.
// `isNewResume` is forwarded so the very first cloud write can seed visibility
// and the metric counters without touching them on later saves.
export function persistResume(id, updates) {
  const local = saveResume(id, updates)
  const { isNewResume = false, ...rest } = updates
  saveResumeToFirestore(id, rest, { isNewResume }).catch((err) => {
    const code = err?.code || err?.cause?.code || ''
    if (code !== 'permission-denied') {
      console.error('[resumeStorage] Failed to save resume to Firestore:', err)
    }
  })
  return local
}

/**
 * Resolves the authoritative copy of a resume while the editor boots.
 *
 * The local draft paints instantly, but a resume edited on another device is
 * newer than any local copy — blindly preferring local (as the old code did)
 * silently reverted those changes. This returns whichever copy has the larger
 * `updatedAt` so cross-device edits survive.
 */
export async function resolveFreshestResume(id, localResume) {
  if (!id || !isCloudSyncEnabled()) {
    return { resume: localResume, source: 'local' }
  }
  try {
    const remote = await getResumeFromFirestore(id)
    if (!remote) {
      return { resume: localResume, source: 'local' }
    }
    const localTime = (localResume && localResume.updatedAt) || 0
    const remoteTime = remote.updatedAt || 0
    if (remoteTime > localTime) {
      // Mirror the newer cloud copy locally so subsequent paints are instant.
      const all = loadAll()
      const idx = all.findIndex((r) => r.id === id)
      const merged = { ...remote, id }
      if (idx === -1) all.push(merged)
      else all[idx] = { ...all[idx], ...merged }
      saveAll(all)
      return { resume: { ...localResume, ...merged }, source: 'cloud' }
    }
    return { resume: localResume, source: 'local' }
  } catch (err) {
    console.warn('[resumeStorage] Cloud resume lookup failed; using local copy:', err)
    return { resume: localResume, source: 'local' }
  }
}

// ---------------------------------------------------------------------------
// Resume Vault (list / rename / duplicate / visibility in Firestore)
// ---------------------------------------------------------------------------

export async function getUserResumesFromFirestore(userId) {
  if (!firebaseConfigured || !userId) {
    return []
  }
  const db = getDb()
  const q = query(collection(db, COLLECTION), where('userId', '==', userId), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function renameResumeInFirestore(id, name) {
  if (!id || !name || !isCloudSyncEnabled()) return null
  const db = getDb()
  const ref = doc(db, COLLECTION, id)
  const payload = { name: String(name).trim() || 'My Resume', updatedAt: Date.now() }
  await setDoc(ref, payload, { merge: true })
  if (getResume(id)) {
    saveResume(id, { name: payload.name })
  }
  return payload
}

export async function duplicateResumeInFirestore(id, userId) {
  if (!id || !isCloudSyncEnabled()) return null
  const ownerId = signedInUserId()
  const source = await getResumeFromFirestore(id)
  if (!source) return null
  const copyId = generateId()
  const payload = {
    resumeType: source.resumeType || 'fresher',
    formData: source.formData || {},
    qrCodeEnabled: !!source.qrCodeEnabled,
    config: source.config || null,
    name: `${source.name || defaultResumeName(source.formData) || 'My Resume'} (Copy)`,
    userId: ownerId || userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    views: 0,
    downloads: 0,
    qrScans: 0,
  }
  // A duplicate is a brand-new document: it is created private to satisfy the
  // security rule, then flipped only if the source was public. Copying a private
  // resume used to publish the copy unconditionally, which quietly exposed a
  // draft that its owner had deliberately kept private.
  const copyIsPublic = source.isPublic === true
  await setDoc(firestoreDoc(copyId), { ...payload, isPublic: false })
  if (copyIsPublic) {
    await setDoc(firestoreDoc(copyId), { isPublic: true, updatedAt: Date.now() }, { merge: true })
  }
  return { ...payload, isPublic: copyIsPublic, id: copyId }
}

export async function toggleResumeVisibility(id, isPublic) {
  if (!id || !isCloudSyncEnabled()) return null
  const db = getDb()
  const ref = doc(db, COLLECTION, id)
  const payload = { isPublic: !!isPublic, updatedAt: Date.now() }
  await setDoc(ref, payload, { merge: true })
  return payload
}

// ---------------------------------------------------------------------------
// Resume metrics: public views, QR scans and downloads
//
// Every counter lives on the resume document itself (`views`, `qrScans`,
// `downloads`) and is tallied with an atomic FieldValue.increment(), so
// concurrent tallies never clobber each other. The Firestore rules allow each
// counter to move by exactly +1 and nothing else, so no client — the owner
// included — can inflate, reset or forge a metric.
// ---------------------------------------------------------------------------

const RESUME_VIEWS_SESSION_KEY = 'resume_public_views'
const RESUME_QR_SCANS_SESSION_KEY = 'resume_qr_scans'

// Records already tallied in this tab/session, so a refresh (or a React
// StrictMode remount, or the auth state resolving and re-running the loader)
// cannot count the same single open more than once. Best-effort: when session
// storage is unavailable the metric still works, it just loses the guard.
function sessionHasRecord(key, resumeId) {
  try {
    const raw = sessionStorage.getItem(key) || ''
    return raw.split(',').filter(Boolean).includes(resumeId)
  } catch {
    return false
  }
}

function sessionMarkRecord(key, resumeId) {
  try {
    const raw = sessionStorage.getItem(key) || ''
    const values = raw ? raw.split(',').filter(Boolean) : []
    if (!values.includes(resumeId)) {
      values.push(resumeId)
      sessionStorage.setItem(key, values.join(','))
    }
  } catch {
    /* session storage unavailable — the guard is best-effort */
  }
}

function sessionForgetRecord(key, resumeId) {
  try {
    const raw = sessionStorage.getItem(key) || ''
    const values = raw ? raw.split(',').filter(Boolean) : []
    sessionStorage.setItem(key, values.filter((id) => id !== resumeId).join(','))
  } catch {
    /* best-effort */
  }
}

export function hasRecordedPublicView(resumeId) {
  return sessionHasRecord(RESUME_VIEWS_SESSION_KEY, resumeId)
}

export function markPublicResumeViewRecorded(resumeId) {
  sessionMarkRecord(RESUME_VIEWS_SESSION_KEY, resumeId)
}

export function forgetPublicResumeView(resumeId) {
  sessionForgetRecord(RESUME_VIEWS_SESSION_KEY, resumeId)
}

export function hasRecordedQrScan(resumeId) {
  return sessionHasRecord(RESUME_QR_SCANS_SESSION_KEY, resumeId)
}

function markQrScanRecorded(resumeId) {
  sessionMarkRecord(RESUME_QR_SCANS_SESSION_KEY, resumeId)
}

function forgetQrScan(resumeId) {
  sessionForgetRecord(RESUME_QR_SCANS_SESSION_KEY, resumeId)
}

function metricErrorCode(err) {
  return (err && (err.code || (err.cause && err.cause.code))) || ''
}

// Shared tally helper: bumps one counter by exactly 1 on the resume document.
async function incrementResumeMetric(resumeId, field) {
  await updateDoc(doc(getDb(), COLLECTION, resumeId), { [field]: increment(1) })
}

// Tallies one public view for a resume. Owner self-views are never counted,
// so opening the resume from the dashboard listing or the editor does not
// inflate the stats. Fire-and-forget: a failure must never break rendering.
export async function recordPublicResumeView(resumeId, { viewerId, ownerId } = {}) {
  if (!resumeId || !firebaseConfigured) return
  // Never count the owner's own public preview as a public view.
  if (ownerId && viewerId && ownerId === viewerId) return
  // Avoid double-counting one page load within the same tab/session.
  if (hasRecordedPublicView(resumeId)) return
  markPublicResumeViewRecorded(resumeId)
  try {
    await incrementResumeMetric(resumeId, 'views')
  } catch (err) {
    forgetPublicResumeView(resumeId)
    const code = metricErrorCode(err)
    if (code !== 'permission-denied' && code !== 'not-found') {
      console.error('[resumeStorage] Failed to record resume view:', err)
    }
  }
}

/**
 * Tallies one QR scan for a resume.
 *
 * A QR code printed on a resume points at this project's public resume page
 * (`/resume/:resumeId`), so a scan is only ever counted once that destination
 * has actually been opened and rendered — never when the QR is merely rendered,
 * copied or downloaded. Owner self-opens are excluded and a session guard keeps
 * a refresh of the same page from counting again.
 */
export async function recordResumeQrScan(resumeId, { viewerId, ownerId } = {}) {
  if (!resumeId || !firebaseConfigured) return
  if (ownerId && viewerId && ownerId === viewerId) return
  if (hasRecordedQrScan(resumeId)) return
  markQrScanRecorded(resumeId)
  try {
    await incrementResumeMetric(resumeId, 'qrScans')
  } catch (err) {
    forgetQrScan(resumeId)
    const code = metricErrorCode(err)
    if (code !== 'permission-denied' && code !== 'not-found') {
      console.error('[resumeStorage] Failed to record QR scan:', err)
    }
  }
}

/**
 * Tallies one successful resume download (PDF or DOCX).
 *
 * Call this only after the browser has actually been handed the file, so a
 * cancelled or failed export is never counted. It resolves to true when the
 * counter was written: only the signed-in owner can write it, which keeps the
 * number tamper-proof (the rules pin every bump to exactly +1). Downloads made
 * while signed out or before the resume reached the cloud are not recorded,
 * because there is no owner document to attribute them to.
 */
export async function recordResumeDownload(resumeId) {
  if (!resumeId || !firebaseConfigured) return false
  if (!isCloudSyncEnabled()) return false
  try {
    await incrementResumeMetric(resumeId, 'downloads')
    return true
  } catch (err) {
    const code = metricErrorCode(err)
    if (code !== 'permission-denied' && code !== 'not-found') {
      console.error('[resumeStorage] Failed to record resume download:', err)
    }
    return false
  }
}
