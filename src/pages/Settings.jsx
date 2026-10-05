import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Bell,
  Check,
  Database,
  Download,
  ExternalLink,
  FileText,
  FolderLock,
  Globe,
  Info,
  LayoutTemplate,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sparkles,
  Sun,
  Settings as SettingsIcon,
  Trash2,
  TriangleAlert,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/useTheme'
import { useTemplate } from '../context/TemplateContext'
import templates from '../data/templates'
import { version as appVersion } from '../../package.json'
import './Settings.css'

// Non-sensitive preferences only. Passwords, API keys and Firebase credentials
// are never read, written or rendered here; the AI key lives on the server and
// this page never touches it.
const SETTINGS_KEY = 'resume_builder_settings'

const DEFAULTS = {
  defaultResumeType: 'fresher',
  defaultTemplateId: '',
  autoSave: true,
  // Private is the safe default: a resume must never become public just because
  // a preference was written.
  defaultVisibility: 'private',
  notifyResumeSave: true,
  notifyAiEnhancement: true,
  notifyProduct: false,
  aiEnhancement: true,
}

const RESUME_TYPES = [
  { value: 'fresher', label: 'Fresher', description: 'Students and recent graduates.' },
  { value: 'experienced', label: 'Experienced', description: 'Working professionals.' },
]

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', description: 'Only you can open the resume.', icon: Lock },
  { value: 'public', label: 'Public', description: 'Anyone with the link can view it.', icon: Globe },
]

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const NOTIFICATION_OPTIONS = [
  { key: 'notifyResumeSave', title: 'Resume save notifications', description: 'Show a notice after a resume is saved to your account.' },
  { key: 'notifyAiEnhancement', title: 'AI enhancement notifications', description: 'Show the result of each AI enhancement request.' },
  { key: 'notifyProduct', title: 'Product and update notifications', description: 'Tell me when new features and templates are added.' },
]

// Local draft storage written by resumeStorage.js. Nothing else is listed here
// on purpose: the theme key, template customizations and these preferences are
// left untouched, and Firestore resumes are never involved.
const DRAFT_KEY_PREFIXES = ['resume_builder_resumes', 'fresher_resume_id', 'experienced_resume_id']

function findLocalDraftKeys() {
  const keys = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key) continue
      if (DRAFT_KEY_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}_`))) {
        keys.push(key)
      }
    }
  } catch {
    return []
  }
  return keys
}

function isOneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function loadSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}')
    const stored = parsed && typeof parsed === 'object' ? parsed : {}
    return {
      defaultResumeType: isOneOf(stored.defaultResumeType, ['fresher', 'experienced'], DEFAULTS.defaultResumeType),
      defaultTemplateId: typeof stored.defaultTemplateId === 'string' ? stored.defaultTemplateId : DEFAULTS.defaultTemplateId,
      autoSave: typeof stored.autoSave === 'boolean' ? stored.autoSave : DEFAULTS.autoSave,
      defaultVisibility: isOneOf(stored.defaultVisibility, ['private', 'public'], DEFAULTS.defaultVisibility),
      notifyResumeSave: typeof stored.notifyResumeSave === 'boolean' ? stored.notifyResumeSave : DEFAULTS.notifyResumeSave,
      notifyAiEnhancement: typeof stored.notifyAiEnhancement === 'boolean' ? stored.notifyAiEnhancement : DEFAULTS.notifyAiEnhancement,
      notifyProduct: typeof stored.notifyProduct === 'boolean' ? stored.notifyProduct : DEFAULTS.notifyProduct,
      aiEnhancement: typeof stored.aiEnhancement === 'boolean' ? stored.aiEnhancement : DEFAULTS.aiEnhancement,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

const SECTIONS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'resume', label: 'Resume', icon: FileText },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'about', label: 'About', icon: Info },
]

function SettingsSection({ id, icon: Icon, title, description, children }) {
  return (
    <section
      id={`settings-section-${id}`}
      className="settings-section"
      aria-labelledby={`settings-heading-${id}`}
      tabIndex={-1}
    >
      <div className="settings-section-head">
        <span className="settings-section-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="settings-section-head-text">
          <h2 className="settings-section-title" id={`settings-heading-${id}`}>
            {title}
          </h2>
          {description && <p className="settings-section-desc">{description}</p>}
        </div>
      </div>
      <div className="settings-card">{children}</div>
    </section>
  )
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label className="settings-field-label" htmlFor={htmlFor}>
      {children}
    </label>
  )
}

function SegmentedGroup({ name, legend, value, options, onChange }) {
  return (
    <div className="settings-field">
      <fieldset className="settings-fieldset">
        <legend className="settings-field-legend">{legend}</legend>
        <div className="settings-segmented">
        {options.map((option) => {
          const Icon = option.icon
          const inputId = `${name}-${option.value}`
          const active = value === option.value
          return (
            <label
              key={option.value}
              className={`settings-segment ${active ? 'active' : ''}`}
              htmlFor={inputId}
            >
              <input
                id={inputId}
                className="settings-segment-input"
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
              />
              <span className="settings-segment-body">
                {Icon && (
                  <span className="settings-segment-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                )}
                <span className="settings-segment-text">
                  <span className="settings-segment-label">{option.label}</span>
                  {option.description && (
                    <span className="settings-segment-hint">{option.description}</span>
                  )}
                </span>
              </span>
            </label>
          )
        })}
        </div>
      </fieldset>
    </div>
  )
}

function SwitchRow({ id, title, description, checked, onChange, badge }) {
  const hintId = description ? `${id}-hint` : undefined
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-row-title" id={`${id}-label`}>
          {title}
        </span>
        {description && (
          <span className="settings-row-desc" id={hintId}>
            {description}
          </span>
        )}
        {badge && <span className="settings-badge">{badge}</span>}
      </div>
      <span className="settings-switch">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-labelledby={`${id}-label`}
          aria-describedby={hintId}
        />
        <span className="settings-switch-track" aria-hidden="true">
          <span className="settings-switch-thumb" />
        </span>
      </span>
    </div>
  )
}

function InfoRow({ label, value, hint, status }) {
  return (
    <div className="settings-row settings-row-static">
      <div className="settings-row-text">
        <span className="settings-row-title">{label}</span>
        {hint && <span className="settings-row-desc">{hint}</span>}
      </div>
      <div className="settings-row-value">
        {status ? (
          <span className={`settings-status ${status}`}>
            <span className="settings-status-dot" aria-hidden="true" />
            {value}
          </span>
        ) : (
          <span className="settings-value-text">{value}</span>
        )}
      </div>
    </div>
  )
}

function ActionRow({ icon: Icon, title, description, buttonLabel, disabled, disabledReason, onClick, danger }) {
  return (
    <div className="settings-row settings-row-action">
      <div className="settings-row-text">
        <span className="settings-row-title">
          {Icon && (
            <span className={`settings-row-icon ${danger ? 'danger' : ''}`} aria-hidden="true">
              <Icon size={17} />
            </span>
          )}
          {title}
        </span>
        <span className="settings-row-desc">{description}</span>
        {disabled && disabledReason && (
          <span className="settings-row-note">
            <AlertCircle size={14} />
            {disabledReason}
          </span>
        )}
      </div>
      <button
        type="button"
        className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-secondary'} settings-action-btn`}
        onClick={onClick}
        disabled={disabled}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function Settings() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { customTemplates } = useTemplate()
  const navigate = useNavigate()

  const [settings, setSettings] = useState(loadSettings)
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
  const [toast, setToast] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [draftKeys, setDraftKeys] = useState(() => findLocalDraftKeys())
  const [clearing, setClearing] = useState(false)
  const toastTimer = useRef(null)

  // Preferences live in this browser only, so they survive a reload without
  // adding a single Firestore write.
  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* storage unavailable — the preference simply is not remembered */
    }
  }, [settings])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const notify = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const update = useCallback((key, value) => {
    setSettings((previous) => ({ ...previous, [key]: value }))
  }, [])

  // Scroll spy: keeps the sidebar (or the mobile chip row) on the section the
  // reader is actually looking at.
  useEffect(() => {
    const onScroll = () => {
      const marker = window.scrollY + 200
      let current = SECTIONS[0].id
      for (const section of SECTIONS) {
        const el = document.getElementById(`settings-section-${section.id}`)
        if (!el) continue
        const top = el.getBoundingClientRect().top + window.scrollY
        if (top <= marker) current = section.id
      }
      setActiveSection(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const jumpTo = useCallback((id) => {
    const el = document.getElementById(`settings-section-${id}`)
    if (!el) return
    setActiveSection(id)
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    if (!confirmOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !clearing) setConfirmOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmOpen, clearing])

  // The real template list from data/templates.js, plus the templates this
  // browser has customized. Nothing here is invented.
  const templateOptions = useMemo(() => {
    const base = templates.map((template) => ({ id: template.id, name: template.name }))
    const custom = (Array.isArray(customTemplates) ? customTemplates : [])
      .filter((template) => template && template.templateId)
      .map((template) => ({ id: template.templateId, name: `${template.name} (custom)` }))
    const seen = new Set()
    return [...base, ...custom].filter((option) => {
      if (seen.has(option.id)) return false
      seen.add(option.id)
      return true
    })
  }, [customTemplates])

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/')
  }, [logout, navigate])

  const openClearDrafts = useCallback(() => {
    setDraftKeys(findLocalDraftKeys())
    setConfirmOpen(true)
  }, [])

  const clearLocalDrafts = useCallback(() => {
    setClearing(true)
    try {
      for (const key of findLocalDraftKeys()) {
        window.localStorage.removeItem(key)
      }
    } catch {
      setClearing(false)
      setConfirmOpen(false)
      notify('Could not clear local drafts in this browser.', 'error')
      return
    }
    setClearing(false)
    setConfirmOpen(false)
    setDraftKeys(findLocalDraftKeys())
    notify('Local drafts cleared. Your saved resumes are untouched.')
  }, [notify])

  const displayName = (user && user.displayName && user.displayName.trim()) || ''
  const email = (user && user.email) || ''
  const isVerified = Boolean(user && user.emailVerified)
  const initial = (displayName || email || 'U').charAt(0).toUpperCase()

  return (
    <div className="settings-page">
      <div className="container">
        <header className="settings-header">
          <div className="settings-header-icon" aria-hidden="true">
            <SettingsIcon size={24} />
          </div>
          <div className="settings-header-text">
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">
              Manage your account, resume preferences, appearance, privacy, and application settings.
            </p>
          </div>
        </header>

        {toast && (
          <div className={`settings-toast ${toast.type}`} role="status">
            {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        )}

        <div className="settings-layout">
          <nav className="settings-sidebar" aria-label="Settings sections">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const active = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`settings-sidebar-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => jumpTo(section.id)}
                >
                  <span className="settings-sidebar-icon" aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <span className="settings-sidebar-label">{section.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="settings-content">
            <SettingsSection id="account" icon={User} title="Account" description="Your signed-in identity and session.">
              <div className="settings-identity">
                <span className="settings-avatar" aria-hidden="true">
                  {initial}
                </span>
                <div className="settings-identity-text">
                  <span className="settings-identity-name">{displayName || 'Name not set'}</span>
                  <span className="settings-identity-email">{email || 'No email on file'}</span>
                </div>
              </div>

              <InfoRow label="Name" value={displayName || 'Not provided'} />
              <InfoRow label="Email" value={email || 'Not available'} />
              <InfoRow
                label="Status"
                value="Active"
                status="active"
                hint={isVerified ? 'Email verified.' : 'Signed in. Email address is not verified yet.'}
              />

              <div className="settings-row settings-row-action">
                <div className="settings-row-text">
                  <span className="settings-row-title">
                    <span className="settings-row-icon danger" aria-hidden="true">
                      <LogOut size={17} />
                    </span>
                    Logout
                  </span>
                  <span className="settings-row-desc">
                    Sign out of ResumeBuilder on this device.
                  </span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm settings-action-btn" onClick={handleLogout}>
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </SettingsSection>

            <SettingsSection id="appearance" icon={Palette} title="Appearance" description="Choose how ResumeBuilder looks for you.">
              <SegmentedGroup
                name="settings-theme"
                legend="Theme"
                value={theme}
                options={THEME_OPTIONS}
                onChange={(value) => {
                  setTheme(value)
                  notify('Theme updated.')
                }}
              />
              <p className="settings-footnote">
                The theme is shared with the switcher in the navigation and follows your device when set to
                System.
              </p>
            </SettingsSection>

            <SettingsSection
              id="resume"
              icon={FileText}
              title="Resume Preferences"
              description="Defaults applied when you start building a resume."
            >
              <SegmentedGroup
                name="settings-resume-type"
                legend="Default Resume Type"
                value={settings.defaultResumeType}
                options={RESUME_TYPES}
                onChange={(value) => update('defaultResumeType', value)}
              />

              <div className="settings-field">
                <FieldLabel htmlFor="settings-default-template">Default Template</FieldLabel>
                <select
                  id="settings-default-template"
                  className="settings-select"
                  value={settings.defaultTemplateId}
                  onChange={(event) => update('defaultTemplateId', event.target.value)}
                >
                  <option value="">No default &mdash; ask me each time</option>
                  {templateOptions.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <p className="settings-row-desc">
                  <Link to="/templates" className="settings-link">
                    <LayoutTemplate size={14} />
                    Browse templates
                  </Link>
                </p>
              </div>

              <SwitchRow
                id="settings-auto-save"
                title="Enable automatic saving"
                description="Editors already save your progress as you type. This preference is stored for you and does not change the saving behaviour."
                checked={settings.autoSave}
                onChange={(value) => update('autoSave', value)}
                badge="Preference only"
              />
            </SettingsSection>

            <SettingsSection id="privacy" icon={ShieldCheck} title="Privacy" description="Who can see your resumes.">
              <SegmentedGroup
                name="settings-visibility"
                legend="Default Resume Visibility"
                value={settings.defaultVisibility}
                options={VISIBILITY_OPTIONS}
                onChange={(value) => update('defaultVisibility', value)}
              />
              <p className="settings-footnote">
                New resumes are always created private. Changing visibility for a resume that already exists is
                done from the Resume Vault, and this preference does not change any saved resume.
              </p>

              <div className="settings-callout">
                <div className="settings-callout-head">
                  <Globe size={17} />
                  <span className="settings-row-title">Public Resume</span>
                </div>
                <p className="settings-callout-text">
                  Public resumes can be viewed by anyone with your public resume link. Keep a resume private
                  until you are ready to share it.
                </p>
                <Link to="/resume-vault" className="settings-link">
                  <FolderLock size={14} />
                  Manage visibility in Resume Vault
                  <ExternalLink size={13} />
                </Link>
              </div>
            </SettingsSection>

            <SettingsSection
              id="notifications"
              icon={Bell}
              title="Notifications"
              description="Stored on this device only. ResumeBuilder does not send email or push notifications."
            >
              {NOTIFICATION_OPTIONS.map((option) => (
                <SwitchRow
                  key={option.key}
                  id={`settings-${option.key}`}
                  title={option.title}
                  description={option.description}
                  checked={settings[option.key]}
                  onChange={(value) => update(option.key, value)}
                />
              ))}
            </SettingsSection>

            <SettingsSection
              id="ai"
              icon={Sparkles}
              title="AI Resume Enhancement"
              description="Use AI to improve resume content, summaries, experience descriptions, and other supported sections."
            >
              <SwitchRow
                id="settings-ai-enhancement"
                title="AI Enhancement"
                description="Records your preference. Enhancement in Enhance Resume is unchanged, so this switch does not turn the AI features on or off yet."
                checked={settings.aiEnhancement}
                onChange={(value) => {
                  update('aiEnhancement', value)
                  notify(value ? 'AI Enhancement enabled.' : 'AI Enhancement disabled.')
                }}
                badge="Preference only"
              />
              <div className="settings-callout">
                <div className="settings-callout-head">
                  <Sparkles size={17} />
                  <span className="settings-row-title">How your data is handled</span>
                </div>
                <p className="settings-callout-text">
                  Enhancement requests are sent through the ResumeBuilder server to the AI provider. API
                  credentials stay on the server and are never part of this page or your browser.
                </p>
              </div>
            </SettingsSection>

            <SettingsSection id="data" icon={Database} title="Data & Privacy" description="Your data and this browser.">
              <ActionRow
                icon={Download}
                title="Export Resume Data"
                description="Download a copy of your account and resume data as a file."
                buttonLabel="Export My Data"
                disabled
                disabledReason="Not available yet. There is no account export in ResumeBuilder, so this button stays off rather than pretending to work."
              />

              <ActionRow
                icon={Trash2}
                title="Clear Local Drafts"
                description="Remove resume drafts and editor pointers stored in this browser only. Your cloud resumes are not deleted."
                buttonLabel="Clear Local Drafts"
                disabled={draftKeys.length === 0}
                disabledReason={draftKeys.length === 0 ? 'No local drafts are stored in this browser.' : null}
                onClick={openClearDrafts}
              />

              <ActionRow
                icon={TriangleAlert}
                title="Delete Account"
                description="Deleting your account is permanent."
                buttonLabel="Delete Account"
                disabled
                disabledReason="Account deletion is not currently available."
                danger
              />
            </SettingsSection>

            <SettingsSection id="about" icon={Info} title="About ResumeBuilder" description="Version and links.">
              <div className="settings-about">
                <div className="settings-about-brand">
                  <span className="settings-about-logo" aria-hidden="true">
                    RB
                  </span>
                  <div>
                    <span className="settings-about-name">ResumeBuilder</span>
                    <span className="settings-about-tagline">
                      A professional resume-building platform for students, freshers, and professionals.
                    </span>
                  </div>
                </div>
                <span className="settings-version">Version {appVersion}</span>
              </div>

              <ul className="settings-links">
                <li>
                  <Link to="/feedback" className="settings-link">
                    <Mail size={14} />
                    Feedback
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="settings-link">
                    <Lock size={14} />
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="settings-link">
                    <Info size={14} />
                    Terms
                  </Link>
                </li>
              </ul>
            </SettingsSection>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="settings-modal-overlay" onClick={() => !clearing && setConfirmOpen(false)}>
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-clear-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="settings-modal-close"
              onClick={() => setConfirmOpen(false)}
              disabled={clearing}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className="settings-modal-icon" aria-hidden="true">
              <TriangleAlert size={24} />
            </div>
            <h3 className="settings-modal-title" id="settings-clear-title">
              Clear local drafts?
            </h3>
            <p className="settings-modal-text">
              This will remove locally stored draft data from this browser.
              <br />
              Your saved cloud resumes will not be deleted.
            </p>
            {draftKeys.length > 0 && (
              <p className="settings-modal-hint">
                {draftKeys.length} local draft item{draftKeys.length === 1 ? '' : 's'} will be removed.
              </p>
            )}
            <div className="settings-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmOpen(false)}
                disabled={clearing}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={clearLocalDrafts} disabled={clearing}>
                {clearing ? 'Clearing...' : 'Clear Drafts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings