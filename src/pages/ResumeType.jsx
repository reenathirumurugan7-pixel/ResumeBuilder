import { useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Briefcase, Folder, Check } from 'lucide-react'
import { clearEditorResumeId } from '../utils/resumeStorage'
import { loadSettings } from '../config/settings'
import './ResumeType.css'

function ResumeType() {
  const navigate = useNavigate()
  const defaultResumeType = loadSettings().defaultResumeType

  const handleNewFresher = useCallback(() => {
    clearEditorResumeId('fresher_resume_id')
    navigate('/editor/fresher')
  }, [navigate])

  const handleNewExperienced = useCallback(() => {
    clearEditorResumeId('experienced_resume_id')
    navigate('/editor/experienced')
  }, [navigate])

  return (
    <div className="resume-type-page">
      <div className="container">
        <div className="resume-type-header">
          <h1 className="resume-type-title">Choose Your Resume Type</h1>
          <p className="resume-type-subtitle">
            Select the type that best matches your experience level
          </p>
        </div>

        <div className="resume-type-cards">
          <div className="resume-type-card fresher-card">
            {defaultResumeType === 'fresher' && <span className="resume-type-default-badge">Default</span>}
            <div className="resume-type-icon fresher-icon">
              <GraduationCap size={40} strokeWidth={1.5} />
            </div>
            <h2 className="resume-type-card-title">Fresher</h2>
            <p className="resume-type-card-desc">
              For students and recent graduates. Highlight your education, skills,
              projects, and internships.
            </p>
            <ul className="resume-type-features">
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Education details
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Skills and projects
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Internship experience
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Career objective
              </li>
            </ul>
            <button onClick={handleNewFresher} className="btn btn-primary resume-type-btn" autoFocus={defaultResumeType === 'fresher'}>
              Create Fresher Resume
            </button>
          </div>

          <div className="resume-type-card experienced-card">
            {defaultResumeType === 'experienced' && <span className="resume-type-default-badge">Default</span>}
            <div className="resume-type-icon experienced-icon">
              <Briefcase size={40} strokeWidth={1.5} />
            </div>
            <h2 className="resume-type-card-title">Experienced</h2>
            <p className="resume-type-card-desc">
              For working professionals. Showcase your work experience, skills,
              and career achievements.
            </p>
            <ul className="resume-type-features">
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Work experience
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Professional summary
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Skills and certifications
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Portfolio link
              </li>
            </ul>
            <button onClick={handleNewExperienced} className="btn btn-primary resume-type-btn" autoFocus={defaultResumeType === 'experienced'}>
              Create Experienced Resume
            </button>
          </div>

          <div className="resume-type-card vault-card">
            <div className="resume-type-icon vault-icon">
              <Folder size={40} strokeWidth={1.5} />
            </div>
            <h2 className="resume-type-card-title">Resume Vault</h2>
            <p className="resume-type-card-desc">
              Securely access and manage all your saved resumes.
            </p>
            <ul className="resume-type-features">
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Preview and download saved resumes
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Share via QR or public link
              </li>
              <li>
                <Check size={16} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />
                Duplicate, rename, or delete
              </li>
            </ul>
            <Link to="/resume-vault" className="btn btn-primary resume-type-btn">
              Open Resume Vault
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResumeType
