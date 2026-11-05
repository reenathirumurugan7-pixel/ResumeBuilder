import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, CheckCircle, XCircle, AlignLeft, Printer } from 'lucide-react'
import PersonalInfo from '../components/PersonalInfo'
import WorkExperience from '../components/WorkExperience'
import Education from '../components/Education'
import Skills from '../components/Skills'
import Languages from '../components/Languages'
import Projects from '../components/Projects'
import Certifications from '../components/Certifications'
import Achievements from '../components/Achievements'
import QRCodeSection from '../components/QRCodeSection'
import AiAssistant from '../components/AiAssistant'
import AiSuggestions from '../components/AiSuggestions'
import { useTemplate } from '../context/TemplateContext'
import templates from '../data/templates'
import ResumePreviewPanel from '../components/ResumePreviewPanel'
import ResumeCompleteness from '../components/ResumeCompleteness'
import AtsScorePanel from '../components/AtsScorePanel'
import { VersionControls } from '../components/VersionHistory'
import { sanitizeVersionSnapshot } from '../services/resumeVersions'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../firebase'
import { getResume, getResumeFromFirestore, initResume, claimGuestDrafts, recordResumeDownload, resolveFreshestResume, saveResume, saveResumeToFirestore } from '../utils/resumeStorage'
import { defaultTemplateConfig, defaultVisibilityIsPublic, isAutoSaveEnabled } from '../config/settings'
import { printResume } from '../utils/printResume'
import './Editor.css'

// Typing must not produce one Firestore write per keystroke, so the cloud write
// is coalesced into a single trailing save.
const CLOUD_SAVE_DEBOUNCE_MS = 1200

const initialData = {
  personalInfo: {
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio: '',
  },
  professionalSummary: '',
  workExperience: [],
  education: [],
  skills: [],
  languages: [],
  projects: [],
  certifications: [],
  achievements: [],
}

function ExperiencedEditor() {
  const { selectedConfig } = useTemplate()
  const { user } = useAuth()
  const autoSaveEnabled = isAutoSaveEnabled()
  const [init] = useState(() =>
    initResume({ storedKey: 'experienced_resume_id', resumeType: 'experienced', defaultData: initialData, config: selectedConfig || defaultTemplateConfig() }),
  )
  const [resumeId] = useState(init.id)
  const [formData, setFormData] = useState(init.formData)
  const [qrCodeEnabled, setQrCodeEnabled] = useState(init.qrCodeEnabled)
  // The resume keeps its own template configuration. The global selection is only
  // a starting point for brand-new resumes, otherwise loading this editor would
  // overwrite the colours/photo stored on the resume itself.
  const [activeConfig, setActiveConfig] = useState(init.config || selectedConfig)
  const [hydrated, setHydrated] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveMsg, setSaveMsg] = useState(null)
  const saveTimer = useRef(null)
  const cloudTimer = useRef(null)
  // The exact live-preview element this editor owns, so a PDF export is scoped
  // to it and can never pick up another resume preview elsewhere in the document.
  const previewRef = useRef(null)
  // Set when the global template differs from the resume's own template so the
  // next deliberate template choice is adopted instead of being ignored.
  const adoptTemplateChange = useRef(false)
  const userId = user ? user.uid : null
  const seedVisibility = useRef(init.isNew === true)

  // Local draft is written synchronously on every change (cheap, offline-safe);
  // the cloud copy is debounced and only sent while signed in. Auto Save off
  // disables this effect entirely; saving then happens on manual saves only.
  useEffect(() => {
    if (!hydrated) return undefined
    if (!autoSaveEnabled) return undefined
    const payload = { formData, qrCodeEnabled, resumeType: 'experienced', config: activeConfig }
    saveResume(resumeId, payload)
    if (!userId || !firebaseConfigured) return undefined

    if (cloudTimer.current) clearTimeout(cloudTimer.current)
    cloudTimer.current = setTimeout(() => {
      setSaveStatus('saving')
      const isNewResume = seedVisibility.current
      // Only a resume that has never reached Firestore gets its visibility
      // seeded (from Settings); every later save leaves visibility untouched.
      const seedWrite = isNewResume ? { isPublic: defaultVisibilityIsPublic() } : {}
      saveResumeToFirestore(resumeId, { ...payload, ...seedWrite }, { isNewResume })
        .then((written) => {
          // Only stop seeding visibility once a write actually landed, so a
          // resume started anonymously still gets its seed on the first real save.
          if (written) {
            seedVisibility.current = false
            setSaveStatus('saved')
          } else {
            setSaveStatus('idle')
          }
        })
        .catch((err) => {
          console.error('[ExperiencedEditor] Autosave failed:', err)
          setSaveStatus('error')
        })
    }, CLOUD_SAVE_DEBOUNCE_MS)
    return () => {
      if (cloudTimer.current) clearTimeout(cloudTimer.current)
    }
  }, [formData, qrCodeEnabled, resumeId, activeConfig, userId, hydrated, autoSaveEnabled])

  // Resolve the newest copy on boot: a resume edited on another device is newer
  // than this browser's local draft.
  useEffect(() => {
    let cancelled = false
    // Adopt anything drafted while signed out once an account is known.
    if (userId) claimGuestDrafts()
    resolveFreshestResume(resumeId, getResume(resumeId))
      .then(({ resume, source }) => {
        if (cancelled) return
        if (resume && resume.formData) {
          setFormData(resume.formData)
          setQrCodeEnabled(!!resume.qrCodeEnabled)
          setActiveConfig((prev) => resume.config || prev)
          saveResume(resumeId, {
            formData: resume.formData,
            qrCodeEnabled: !!resume.qrCodeEnabled,
            resumeType: 'experienced',
            config: resume.config || null,
            name: resume.name || '',
            createdAt: resume.createdAt,
          })
        }
        if (source === 'cloud') {
          seedVisibility.current = false
          setSaveMsg({ type: 'success', text: 'Loaded the newer version saved on your other device.' })
        }
        setHydrated(true)
      })
      .catch(() => setHydrated(true))
    return () => {
      cancelled = true
    }
  }, [resumeId, userId])

  // Adopt an explicit template choice made from /templates or /customize, while
  // leaving a resume's own stored configuration alone on load.
  useEffect(() => {
    if (!hydrated) return
    if (adoptTemplateChange.current) {
      adoptTemplateChange.current = false
      setActiveConfig(selectedConfig)
      return
    }
    if (selectedConfig && selectedConfig.templateId !== (activeConfig && activeConfig.templateId)) {
      adoptTemplateChange.current = true
    }
    // `activeConfig` is intentionally excluded: this effect only reacts to the
    // user picking a template, never to config being restored from storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, selectedConfig])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (cloudTimer.current) clearTimeout(cloudTimer.current)
    }
  }, [])

  const selectedTemplateId = activeConfig ? activeConfig.templateId : null
  const selectedTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null
  const previewConfig = activeConfig
    ? { ...activeConfig, name: selectedTemplate ? selectedTemplate.name : 'Template' }
    : null

  // Same baseline as the fresher editor: a downloaded resume must carry the
  // details a recruiter needs to reach the candidate.
  const validate = () => {
    const newErrors = {}
    const info = formData.personalInfo || {}
    if (!info.fullName || !info.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }
    if (!info.email || !info.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())) {
      newErrors.email = 'Please enter a valid email'
    }
    if (!info.phone || !info.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    }
    if (formData.workExperience.length === 0) {
      newErrors.workExperience = 'At least one work experience entry is required'
    }
    if (formData.skills.length === 0) {
      newErrors.skills = 'At least one skill is required'
    }
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    setSubmitted(true)
    if (Object.keys(validationErrors).length > 0) {
      setDownloadMsg({ type: 'error', text: 'Please fix the highlighted fields before downloading.' })
      setTimeout(() => setDownloadMsg(null), 3000)
      return
    }
    setDownloading(true)
    setDownloadMsg(null)
    try {
      // jsPDF is large and only needed on an actual download, so it is loaded on
      // demand rather than with the editor itself.
      const { generatePDF } = await import('../utils/pdfExport')
      // Awaiting the export means the file has been handed to the browser
      // before we report success or count the download.
      const fileName = await generatePDF(formData, 'experienced', activeConfig, {
        qrCodeEnabled,
        resumeId,
        root: previewRef.current,
      })
      setDownloadMsg({ type: 'success', text: `Downloaded: ${fileName}` })
      // Counted only after the PDF was actually produced, so a cancelled or
      // failed download is never tallied.
      recordResumeDownload(resumeId)
    } catch {
      setDownloadMsg({ type: 'error', text: 'Failed to generate PDF. Please try again.' })
    } finally {
      setDownloading(false)
      setTimeout(() => setDownloadMsg(null), 3000)
    }
  }

  const handleSave = async () => {
    if (saveStatus === 'saving') return
    const validationErrors = validate()
    setErrors(validationErrors)
    setSubmitted(true)
    if (Object.keys(validationErrors).length > 0) {
      setSaveMsg({ type: 'error', text: 'Please fix the highlighted fields before saving.' })
      return
    }
    if (!firebaseConfigured) {
      setSaveMsg({ type: 'error', text: 'Firebase is not configured. Your resume could not be saved to the cloud.' })
      return
    }
    if (!userId) {
      setSaveMsg({ type: 'error', text: 'You must be logged in to save your resume.' })
      return
    }
    setSaveStatus('saving')
    setSaveMsg(null)
    try {
      if (cloudTimer.current) clearTimeout(cloudTimer.current)
      saveResume(resumeId, { formData, qrCodeEnabled, resumeType: 'experienced', config: activeConfig })
      const existing = await getResumeFromFirestore(resumeId)
      // Only a resume that has never reached Firestore gets its visibility and
      // view counter seeded; every other save leaves both untouched.
      await saveResumeToFirestore(
        resumeId,
        {
          formData,
          qrCodeEnabled,
          resumeType: 'experienced',
          config: activeConfig,
          ...(existing ? {} : { isPublic: defaultVisibilityIsPublic() }),
        },
        { isNewResume: !existing },
      )
      seedVisibility.current = false
      setSaveStatus('saved')
      setSaveMsg({ type: 'success', text: 'Resume saved successfully!' })
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        setSaveStatus('idle')
        setSaveMsg(null)
      }, 3000)
    } catch {
      setSaveStatus('idle')
      setSaveMsg({ type: 'error', text: 'Failed to save resume. Please try again.' })
    }
  }

  // Applies a saved version snapshot to the editor. Data is replaced first,
  // validation state is cleared, and the restored values are written straight
  // to the local draft — cloud sync then follows the normal autosave/manual
  // save path, so restoring is not itself a version-creating action.
  const handleRestoreVersion = async (snapshot) => {
    const clean = sanitizeVersionSnapshot(snapshot)
    if (!clean) {
      throw new Error('This version could not be restored because its saved data is missing.')
    }
    setFormData(clean.formData)
    setQrCodeEnabled(clean.qrCodeEnabled)
    setActiveConfig((prev) => clean.config || prev)
    setErrors({})
    setSubmitted(false)
    setSaveMsg(null)
    saveResume(resumeId, {
      formData: clean.formData,
      qrCodeEnabled: clean.qrCodeEnabled,
      resumeType: 'experienced',
      config: clean.config,
    })
  }

  const updatePersonalInfo = (data) => {
    setFormData((prev) => ({ ...prev, personalInfo: data }))
    if (submitted) {
      const newErrors = { ...errors }
      delete newErrors.fullName
      delete newErrors.email
      delete newErrors.phone
      setErrors(newErrors)
    }
  }

  const handlePersonalPhotoChange = (photo) => {
    setActiveConfig((prev) => ({ ...(prev || {}), photo: photo || null }))
    setFormData((prev) => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, photo: photo || null },
    }))
  }

  const updateProfessionalSummary = (value) => {
    setFormData({ ...formData, professionalSummary: value })
  }

  return (
    <div className="editor-page">
      <div className="editor-header">
        <div className="container editor-header-inner">
          <Link to="/resume-type" className="editor-back">
            <ArrowLeft size={20} />
            Back
          </Link>
          <h1 className="editor-title">Experienced Resume Editor</h1>
          {selectedTemplate ? (
            <Link to="/templates" className="editor-template-badge">
              <span className="editor-template-dot" style={{ background: selectedTemplate.colorTheme.primary }}></span>
              {selectedTemplate.name}
            </Link>
          ) : (
            <Link to="/templates" className="editor-back">Choose Template</Link>
          )}
        </div>
      </div>

      <div className="container editor-container">
        <div className="editor-form-panel">
          <form onSubmit={handleSubmit} noValidate>
              <PersonalInfo
                data={formData.personalInfo}
                onChange={updatePersonalInfo}
                onPhotoChange={handlePersonalPhotoChange}
                errors={submitted ? errors : {}}
                showPortfolio
              />

            <div className="form-section">
              <h3 className="form-section-title">
                <AlignLeft size={20} />
                Professional Summary
              </h3>
              <textarea
                className="form-textarea"
                placeholder="Write a compelling professional summary highlighting your expertise, key achievements, and career goals..."
                value={formData.professionalSummary}
                onChange={(e) => updateProfessionalSummary(e.target.value)}
                rows={5}
              />
              <AiAssistant
                text={formData.professionalSummary}
                type="objective"
                label="Improve with AI"
                onApply={updateProfessionalSummary}
              />
            </div>

            <AiSuggestions
              formData={formData}
              resumeType="experienced"
              onApplyField={setFormData}
            />

            {submitted && errors.workExperience && (
              <p className="form-error" style={{ marginBottom: 12, paddingLeft: 4 }}>{errors.workExperience}</p>
            )}
            <WorkExperience
              entries={formData.workExperience}
              onChange={(data) => setFormData({ ...formData, workExperience: data })}
            />

            <Education
              entries={formData.education}
              onChange={(data) => setFormData({ ...formData, education: data })}
            />

            <Skills
              skills={formData.skills}
              onChange={(data) => setFormData({ ...formData, skills: data })}
            />

            <Languages
              languages={formData.languages}
              onChange={(data) => setFormData({ ...formData, languages: data })}
            />

            <Projects
              entries={formData.projects}
              onChange={(data) => setFormData({ ...formData, projects: data })}
            />

            <Certifications
              entries={formData.certifications}
              onChange={(data) => setFormData({ ...formData, certifications: data })}
            />

            <Achievements
              entries={formData.achievements}
              onChange={(data) => setFormData({ ...formData, achievements: data })}
            />

            <QRCodeSection enabled={qrCodeEnabled} onToggle={setQrCodeEnabled} />

            <div className="editor-submit">
              {downloadMsg && (
                <div className={`download-msg ${downloadMsg.type}`}>
                  {downloadMsg.type === 'success' ? (
                    <CheckCircle size={16} strokeWidth={2.5} />
                  ) : (
                    <XCircle size={16} strokeWidth={2.5} />
                  )}
                  {downloadMsg.text}
                </div>
              )}
              {saveMsg && (
                <div className={`download-msg ${saveMsg.type}`}>
                  {saveMsg.type === 'success' ? (
                    <CheckCircle size={16} strokeWidth={2.5} />
                  ) : (
                    <XCircle size={16} strokeWidth={2.5} />
                  )}
                  {saveMsg.text}
                </div>
              )}
              <p className="autosave-hint">
                {!userId
                  ? 'Signed out — changes are kept in this browser only.'
                  : !autoSaveEnabled
                    ? 'Auto save is off — press “Save Resume” to save changes.'
                    : saveStatus === 'error'
                      ? 'Cloud autosave failed. Use “Save Resume” to retry.'
                      : saveStatus === 'saving'
                        ? 'Saving to your account…'
                        : hydrated
                          ? 'All changes are saved to your account.'
                          : 'Loading your resume…'}
              </p>
              <VersionControls
                resumeId={resumeId}
                resumeType="experienced"
                currentSnapshot={{ formData, qrCodeEnabled, config: activeConfig }}
                onRestore={handleRestoreVersion}
                disabled={!hydrated || downloading}
              />
              <div className="editor-actions">
                <button type="submit" className="btn btn-primary submit-btn" disabled={downloading || saveStatus === 'saving'}>
                  {downloading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="download-spinner"></span>
                      Generating PDF...
                    </span>
                  ) : (
                    <>
                      <Download size={18} />
                      Download
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => printResume(formData, 'experienced')}
                  disabled={downloading || saveStatus === 'saving'}
                >
                  <Printer size={18} />
                  Print
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary save-resume-btn${saveStatus === 'saved' ? ' is-saved' : ''}`}
                  onClick={handleSave}
                  disabled={saveStatus === 'saving' || downloading}
                >
                  {saveStatus === 'saving' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="download-spinner"></span>
                      Saving...
                    </span>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <CheckCircle size={18} />
                      ✓ Saved
                    </>
                  ) : (
                    <>💾 Save Resume</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        <ResumePreviewPanel
          config={previewConfig}
          data={formData}
          resumeType="experienced"
          qrCodeEnabled={qrCodeEnabled}
          resumeId={resumeId}
          panelRef={previewRef}
        >
          <ResumeCompleteness data={formData} resumeType="experienced" />
          <AtsScorePanel data={formData} resumeType="experienced" />
        </ResumePreviewPanel>
      </div>
    </div>
  )
}

export default ExperiencedEditor
