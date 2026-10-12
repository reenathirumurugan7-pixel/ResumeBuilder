import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, ShieldCheck, Unlock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { firebaseConfigured } from '../../firebase'
import { ADMIN_API_BASE } from '../../config/admin'
import { AdminNote, AdminSectionHead } from './State'
import { formatDateTime } from './utils'
import './Admin.css'

const LAYERS = [
  {
    title: 'Firestore rules',
    detail:
      'firestore.rules defines isAdmin() and only lets an admin read the resumes collection, list or delete feedback, and delete resumes. A non-admin token is rejected at the database boundary itself.',
  },
  {
    title: 'Server API',
    detail:
      'The users API re-verifies the ID token and the admin claim on every request with the same verifier the AI endpoints use, so it cannot be called by a forged or non-admin client.',
  },
  {
    title: 'No auto-provisioning in the app',
    detail:
      'No code path in the app can grant admin. The claim is only ever added by an Admin SDK script or an admin you run yourself.',
  },
]

// A locked-in constraint, not a feature list: admin status is never derived from
// emails or an allowlist in the client. See LAYERS above.
const PROVISIONING_STEPS = [
  'Create the account in the Firebase console (Authentication → Add user).',
  'Run scripts/set-admin.js <uid|email> with a service account for this project.',
  'Sign in with that account — the Admin Console appears under /admin.',
  'Revokes work the same way: scripts/set-admin.js --remove <uid|email>.',
]

export default function AdminSettings() {
  const { user } = useAuth()
  const [claimInfo, setClaimInfo] = useState(null)
  const [claimLoading, setClaimLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function readClaim() {
      if (!user) return null
      try {
        const result = await user.getIdTokenResult(true)
        return {
          uid: result.claims.sub || user.uid,
          admin: result.claims && result.claims.admin === true,
          authTime: result.authTime,
          expirationTime: result.expirationTime,
        }
      } catch {
        try {
          const cached = await user.getIdTokenResult()
          return {
            uid: cached.claims.sub || user.uid,
            admin: cached.claims && cached.claims.admin === true,
            authTime: cached.authTime,
            expirationTime: cached.expirationTime,
          }
        } catch {
          return null
        }
      }
    }
    readClaim().then((info) => {
      if (active) {
        setClaimInfo(info)
        setClaimLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [user])

  return (
    <div>
      <header className="admin-header">
        <div className="admin-header-text">
          <p className="admin-eyebrow">
            <ShieldCheck size={14} /> Admin status
          </p>
          <h1 className="admin-title">Status & Access</h1>
          <p className="admin-subtitle">
            A read-only view of how admin access is granted and enforced. Nothing here changes
            anything, so an admin cannot lock themselves out of the console.
          </p>
        </div>
      </header>

      {!firebaseConfigured && (
        <AdminNote tone="warning">
          Firebase is not configured in this build, so the console cannot reach the cloud.
        </AdminNote>
      )}

      <section className="admin-section admin-panel" aria-labelledby="admin-access-title">
        <AdminSectionHead icon={KeyRound} title="Your access" note="Signed ID token" />
        {claimLoading ? (
          <div className="admin-rows" aria-hidden="true">
            <div className="admin-row admin-row-skeleton" />
          </div>
        ) : claimInfo ? (
          <div className="admin-rows">
            <article className="admin-row">
              <span className="admin-row-icon">
                {claimInfo.admin ? <CheckCircle2 size={16} /> : <Unlock size={16} />}
              </span>
              <div className="admin-row-main">
                <div className="admin-row-head">
                  <p className="admin-row-name">{user?.email || claimInfo.uid}</p>
                  <span className={`admin-badge ${claimInfo.admin ? 'is-public' : ''}`}>
                    {claimInfo.admin ? 'Admin claim' : 'No admin claim'}
                  </span>
                </div>
                <p className="admin-row-meta">
                  UID {claimInfo.uid} · claimed {formatDateTime(claimInfo.authTime)} · token expires{' '}
                  {formatDateTime(claimInfo.expirationTime)}
                </p>
              </div>
            </article>
          </div>
        ) : (
          <AdminNote tone="warning">This token could not be read.</AdminNote>
        )}
      </section>

      <section className="admin-section admin-panel" aria-labelledby="admin-layers-title">
        <AdminSectionHead icon={ShieldCheck} title="Protection layers" note="Enforced server-side" />
        <div className="admin-rows">
          {LAYERS.map((layer) => (
            <article className="admin-row" key={layer.title}>
              <span className="admin-row-icon is-public">
                <CheckCircle2 size={16} />
              </span>
              <div className="admin-row-main">
                <p className="admin-row-name">{layer.title}</p>
                <p className="admin-row-meta">{layer.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section admin-panel" aria-labelledby="admin-provision-title">
        <AdminSectionHead icon={KeyRound} title="Granting admin access" note="Developer-only" />
        <p className="admin-row-meta" style={{ marginBottom: 12 }}>
          Admin access is <strong>never</strong> granted through the app. To make an account an
          admin, run the provisioning script with this project&apos;s service account:
        </p>
        <div className="admin-rows">
          {PROVISIONING_STEPS.map((step, index) => (
            <article className="admin-row" key={step}>
              <span className="admin-row-icon">
                <ShieldCheck size={16} />
              </span>
              <div className="admin-row-main">
                <p className="admin-row-meta">
                  <strong>{index + 1}.</strong> {step}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section admin-panel" aria-labelledby="admin-env-title">
        <AdminSectionHead icon={ShieldCheck} title="Environment" note="This build" />
        <div className="admin-rows">
          <article className="admin-row">
            <div className="admin-row-main">
              <p className="admin-row-name">Firebase configured</p>
              <p className="admin-row-meta">{firebaseConfigured ? 'Yes — cloud reads/writes active' : 'No — cloud unavailable'}</p>
            </div>
          </article>
          <article className="admin-row">
            <div className="admin-row-main">
              <p className="admin-row-name">Admin API base</p>
              <p className="admin-row-meta">{ADMIN_API_BASE}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}