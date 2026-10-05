import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, LayoutGrid, Eye, Star, Download, CheckCircle, Save, Shield, Info, X } from 'lucide-react'
import ScrollReveal from '../components/ScrollReveal'
import { getAllResumes, getResumeInProgress } from '../utils/resumeStorage'
import './Features.css'

function Features() {
  const navigate = useNavigate()
  const [showAutoSaveModal, setShowAutoSaveModal] = useState(false)
  const [autoSaveMessage, setAutoSaveMessage] = useState(null)

  const getResumeType = useCallback(() => {
    // Namespaced lookup so this reflects the current account's own draft.
    const inProgress = getResumeInProgress()
    if (inProgress) return inProgress.resumeType === 'experienced' ? 'experienced' : 'fresher'
    return 'fresher'
  }, [])

  const hasResumes = useCallback(() => {
    return getAllResumes().length > 0
  }, [])

  const handleCreateResume = useCallback(() => {
    navigate('/resume-type')
  }, [navigate])

  const handleMultipleTemplates = useCallback(() => {
    navigate('/templates')
  }, [navigate])

  const handleLiveResumePreview = useCallback(() => {
    const type = getResumeType()
    navigate(type === 'experienced' ? '/editor/experienced' : '/editor/fresher')
  }, [navigate, getResumeType])

  const handleEnhanceResume = useCallback(() => {
    navigate('/enhance')
  }, [navigate])

  const handlePdfDownload = useCallback(() => {
    if (hasResumes()) {
      navigate('/resume-vault')
    } else {
      setAutoSaveMessage({
        type: 'info',
        text: 'Create a resume first to download a PDF.',
      })
      setTimeout(() => setAutoSaveMessage(null), 5000)
    }
  }, [navigate, hasResumes])

  const handleWordExport = useCallback(() => {
    if (hasResumes()) {
      navigate('/resume-vault')
    } else {
      setAutoSaveMessage({
        type: 'info',
        text: 'Create a resume first to export a Word document.',
      })
      setTimeout(() => setAutoSaveMessage(null), 5000)
    }
  }, [navigate, hasResumes])

  const handleAutoSave = useCallback(() => {
    setShowAutoSaveModal(true)
  }, [])

  const handleAtsFriendly = useCallback(() => {
    if (!hasResumes()) {
      setAutoSaveMessage({
        type: 'info',
        text: 'Complete your resume to view your ATS Score.',
      })
      setTimeout(() => setAutoSaveMessage(null), 5000)
      return
    }
    const type = getResumeType()
    navigate(type === 'experienced' ? '/editor/experienced' : '/editor/fresher')
  }, [navigate, getResumeType, hasResumes])

  const features = [
    {
      icon: <FileText size={28} />,
      title: 'Create Resume',
      description: 'Create a professional resume easily with dedicated Fresher and Experienced resume options.',
      action: handleCreateResume,
    },
    {
      icon: <LayoutGrid size={28} />,
      title: 'Multiple Templates',
      description: 'Choose from 6 professional resume templates designed for different career styles.',
      details: [
        'Modern Blue', 'Professional', 'Minimal',
        'Executive', 'Creative', 'ATS Friendly',
      ],
      action: handleMultipleTemplates,
    },
    {
      icon: <Eye size={28} />,
      title: 'Live Resume Preview',
      description: 'See your resume preview instantly while entering and editing your information.',
      action: handleLiveResumePreview,
    },
    {
      icon: <Star size={28} />,
      title: 'Enhance Resume',
      description: 'Improve your career objective, professional summary and resume content with ResumeBuilder\'s enhancement feature.',
      action: handleEnhanceResume,
    },
    {
      icon: <Download size={28} />,
      title: 'PDF Download',
      description: 'Download your completed resume as a professional PDF.',
      note: 'Enabled after your resume is sufficiently completed.',
      action: handlePdfDownload,
    },
    {
      icon: <CheckCircle size={28} />,
      title: 'Word Export',
      description: 'Export your completed resume as a Word/DOCX document.',
      note: 'Enabled after your resume is sufficiently completed.',
      action: handleWordExport,
    },
    {
      icon: <Save size={28} />,
      title: 'Auto Save',
      description: 'Automatically save your resume information so your work can be restored after refreshing the page.',
      action: handleAutoSave,
    },
    {
      icon: <Shield size={28} />,
      title: 'ATS Friendly',
      description: 'Create a clean, structured resume that is easy for Applicant Tracking Systems to read.',
      action: handleAtsFriendly,
    },
  ]

  const handleCardKeyDown = useCallback((e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }, [])

  return (
    <div className="features-page">
      <div className="features-hero">
        <div className="container">
          <ScrollReveal>
            <h1 className="features-title">Features</h1>
            <p className="features-subtitle">
              Everything you need to build a professional, standout resume
              that gets you noticed by employers.
            </p>
          </ScrollReveal>
        </div>
      </div>

      {autoSaveMessage && (
        <div className={`features-message features-message-${autoSaveMessage.type}`}>
          <Info size={16} />
          <span>{autoSaveMessage.text}</span>
        </div>
      )}

      <section className="features-list-section">
        <div className="container">
          <div className="features-grid">
            {features.map((feature, index) => (
              <ScrollReveal key={index} delay={index * 60}>
                <div
                  className="feature-detail-card feature-detail-card-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={feature.action}
                  onKeyDown={(e) => handleCardKeyDown(e, feature.action)}
                  aria-label={feature.title}
                >
                  <div className="feature-detail-icon">{feature.icon}</div>
                  <h3 className="feature-detail-title">{feature.title}</h3>
                  <p className="feature-detail-description">{feature.description}</p>
                  {feature.details && (
                    <div className="feature-detail-tags">
                      {feature.details.map((item) => (
                        <span className="feature-detail-tag" key={item}>{item}</span>
                      ))}
                    </div>
                  )}
                  {feature.note && (
                    <p className="feature-detail-note">
                      <Info size={14} />
                      {feature.note}
                    </p>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="features-cta-section">
        <div className="container">
          <ScrollReveal>
            <div className="features-cta-card">
              <h2 className="features-cta-title">Ready to Build Your Resume?</h2>
              <p className="features-cta-text">
                Start creating your professional resume today. It&apos;s free and takes just minutes.
              </p>
              <button
                className="btn btn-primary features-cta-btn"
                onClick={handleCreateResume}
              >
                Create Your Resume
              </button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {showAutoSaveModal && (
        <div className="features-modal-overlay" onClick={() => setShowAutoSaveModal(false)}>
          <div className="features-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="features-modal-close"
              onClick={() => setShowAutoSaveModal(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className="features-modal-icon">
              <Save size={28} />
            </div>
            <h3 className="features-modal-title">Auto Save</h3>
            <p className="features-modal-text">
              Your resume is automatically saved as you type, so you never lose your work.
            </p>
            <ul className="features-modal-list">
              <li>Resume is automatically saved.</li>
              <li>Saved resumes are available in Resume Vault.</li>
              <li>Firebase synchronization (when configured).</li>
              <li>Local Storage fallback (when offline).</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default Features
