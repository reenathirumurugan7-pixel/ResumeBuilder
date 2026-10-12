import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// Grants or revokes the `admin: true` custom claim on a Firebase Auth account.
//
//   node scripts/set-admin.js you@example.com        # grant
//   node scripts/set-admin.js <uid> --remove          # revoke
//
// Run from the project root so dotenv finds .env. The claim is the only thing
// that makes an account an admin; it is enforced by firestore.rules, the server
// API, and AdminRoute. This script stays out of the app bundle on purpose: no
// code inside the app can ever grant (or revoke) admin access.
//
// Credentials resolve in this order:
//   1. FIREBASE_SERVICE_ACCOUNT (the service account JSON, or its base64 form)
//   2. FIREBASE_SERVICE_ACCOUNT_PATH (path to the JSON file)
//   3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS locally)

function parseAccount(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // Not plain JSON — try the base64 form.
  }
  try {
    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function getAdminAuth() {
  if (getApps().length) return getAuth()

  const account = parseAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (account) {
    return getAuth(initializeApp({ credential: cert(account), projectId: account.project_id }))
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (path && path.trim()) {
    const accountFromFile = JSON.parse(readFileSync(path.trim(), 'utf8'))
    return getAuth(
      initializeApp({ credential: cert(accountFromFile), projectId: accountFromFile.project_id }),
    )
  }

  return getAuth(initializeApp({ credential: applicationDefault() }))
}

async function main() {
  const args = process.argv.slice(2)
  const remove = args.includes('--remove')
  const target = args.find((arg) => arg !== '--remove')

  if (!target) {
    console.log('Usage: node scripts/set-admin.js <uid|email> [--remove]')
    console.log('  Grants (or with --remove revokes) the admin:true custom claim.')
    process.exit(1)
  }

  const auth = getAdminAuth()

  let record = null
  try {
    record = await auth.getUser(target)
  } catch {
    // Not a uid — try an email below.
  }
  if (!record) {
    try {
      record = await auth.getUserByEmail(target)
    } catch {
      console.error(`No Firebase user matches "${target}" (tried as a uid and as an email).`)
      process.exit(1)
    }
  }

  const current = record.customClaims || {}
  const next = { ...current, admin: remove ? undefined : true }
  if (next.admin === undefined) delete next.admin

  await auth.setCustomUserClaims(record.uid, next)
  const updated = await auth.getUser(record.uid)

  console.log(
    remove
      ? `Removed admin claim from ${record.email || record.uid} (${record.uid}).`
      : `Granted admin claim to ${record.email || record.uid} (${record.uid}).`,
  )
  console.log(`Custom claims now: ${JSON.stringify(updated.customClaims || {})}`)
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})