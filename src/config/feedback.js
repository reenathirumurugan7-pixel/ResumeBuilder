// Central configuration for user feedback.
//
// Feedback is stored in Firestore: the page writes one document per submission
// to the `feedback` collection, and the entries are read from the Firebase
// console. There is no third-party mailbox involved, so no email address is
// configured here.
export const FEEDBACK_COLLECTION = 'feedback';

// The page a submission came from. Useful context when reading entries in the
// console, and it records no personal data — just the route, which for this
// page is always the same.
export const FEEDBACK_PATH = '/feedback';

// Length limits. These are enforced twice on purpose: the browser checks first
// so the visitor gets an immediate, specific message, and `validFeedback()` in
// firestore.rules rejects a document that does not fit, so no client can bypass
// the check. Keep the two in step when changing a number.
export const FEEDBACK_MAX_LENGTH = 2000;
export const FEEDBACK_NAME_MAX_LENGTH = 80;
export const FEEDBACK_PATH_MAX_LENGTH = 100;