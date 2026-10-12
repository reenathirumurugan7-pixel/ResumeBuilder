import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore'
import { getDb, firebaseConfigured } from '../firebase'
import { FEEDBACK_COLLECTION } from '../config/feedback'

// Admin-only reads of the resumes and feedback collections from the browser SDK.
//
// firestore.rules' `isAdmin()` helper is the actual gate: only a signed-in user
// whose verified ID token carries the `admin: true` custom claim may list, read
// or delete these documents. A non-admin caller gets Firestore's
// permission-denied error exactly like any other blocked query — the UI in
// AdminRoute never renders for them in the first place.

const RESUMES_COLLECTION = 'resumes'

function snapshotToArray(snapshot) {
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

export async function getAllResumes() {
  if (!firebaseConfigured) return []
  const db = getDb()
  const q = query(collection(db, RESUMES_COLLECTION), orderBy('updatedAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshotToArray(snapshot)
}

export async function deleteResume(id) {
  const db = getDb()
  await deleteDoc(doc(db, RESUMES_COLLECTION, id))
}

export async function getAllFeedback() {
  if (!firebaseConfigured) return []
  const db = getDb()
  const q = query(collection(db, FEEDBACK_COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshotToArray(snapshot)
}

export async function deleteFeedback(id) {
  const db = getDb()
  await deleteDoc(doc(db, FEEDBACK_COLLECTION, id))
}