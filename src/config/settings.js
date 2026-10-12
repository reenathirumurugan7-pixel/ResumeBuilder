import { findTemplate, templateDefaultConfig } from './customize'

// Shared source of truth for the preferences written on the Settings page.
// Settings.jsx persists these under SETTINGS_KEY; editors and page flows read
// them back through loadSettings() so a stored preference is actually consumed
// by the rest of the application.
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

// Starting template config for a brand-new resume, or null when no default is
// set (or the chosen template no longer exists). Explicit template selections
// take precedence over this default.
function defaultTemplateConfig() {
  const id = loadSettings().defaultTemplateId
  if (!id) return null
  const template = findTemplate(id)
  return template ? templateDefaultConfig(template) : null
}

// True when a brand-new resume should be created/published with public
// visibility. Existing resumes are never affected by this preference.
function defaultVisibilityIsPublic() {
  return loadSettings().defaultVisibility === 'public'
}

// True when the editors should autosave; false keeps manual saves only.
function isAutoSaveEnabled() {
  return loadSettings().autoSave !== false
}

export { SETTINGS_KEY, DEFAULTS, loadSettings, defaultTemplateConfig, defaultVisibilityIsPublic, isAutoSaveEnabled }