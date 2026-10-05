import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Folder, AlertCircle, Lock } from 'lucide-react'
import { getResumeFromFirestore, recordPublicResumeView, recordResumeQrScan, QR_SOURCE_PARAM } from '../utils/resumeStorage'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../firebase'
import LiveResumePreview from '../components/LiveResumePreview'
import { SkeletonResume } from '../components/Skeleton'
import './PublicResume.css'

function StateScreen({ icon, title, text }) {
  return (
    <div className="public-resume-page">
      <div className="container public-resume-empty">
        <div className="public-resume-empty-icon">{icon}</div>
        <h1 className="public-resume-empty-title">{title}</h1>
        {text && <p className="public-resume-empty-text">{text}</p>}
        <Link to="/" className="btn btn-primary">Go to Home</Link>
      </div>
    </div>
  )
}

const notFoundIcon = <Folder size={48} style={{ color: '#94a3b8' }} />

const errorIcon = <AlertCircle size={48} style={{ color: '#dc2626' }} />

function LoadingState() {
  return (
    <div className="public-resume-page">
      <div className="container public-resume-empty">
        <SkeletonResume />
        <p className="public-resume-loading">Loading Resume...</p>
      </div>
    </div>
  )
}

function ResumeLoader({ resumeId }) {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [resume, setResume] = useState(null)
  // Only a QR code encodes `src=qr`, so that parameter is the sole signal that
  // this visit was a scan. Ordinary links (copied from the vault, shared by
  // hand, or opened from an old QR printed before this parameter existed) carry
  // no parameter and are never counted as scans — they still count as views.
  const isQrVisit = searchParams.get('src') === QR_SOURCE_PARAM

  useEffect(() => {
    let active = true

    getResumeFromFirestore(resumeId)
      .then((doc) => {
        if (!active) return
        if (!doc) {
          setStatus('notfound')
          return
        }
        const isOwner = !!user && doc.userId === user.uid
        if (doc.isPublic === true || isOwner) {
          setResume(doc)
          setStatus('loaded')
        } else {
          setStatus('private')
        }
      })
      .catch((error) => {
        if (!active) return
        console.error('Failed to load public resume:', error)
        const code = error && (error.code || (error.cause && error.cause.code))
        if (code === 'permission-denied') {
          setStatus('private')
        } else if (code === 'not-found') {
          setStatus('notfound')
        } else {
          setStatus('error')
        }
      })

    return () => { active = false }
  }, [resumeId, user])

  // Tallies live in their own effect so they wait for the auth state to settle.
  // A view is any anonymous-or-public open of the page; a scan is only the subset
  // reached through a QR code. Both tallies are independent and session-guarded,
  // so refreshing does not count again, and the owner's own preview is excluded
  // inside each helper. Counting inside the fetch effect instead raced auth: on a
  // cold start the document could resolve before `onAuthStateChanged`, and the
  // owner's own visit was tallied while `viewerId` was still null.
  useEffect(() => {
    if (status !== 'loaded' || !resume || authLoading) return
    if (resume.isPublic !== true) return
    const viewerId = user ? user.uid : null
    recordPublicResumeView(resumeId, { viewerId, ownerId: resume.userId })
    if (isQrVisit) {
      recordResumeQrScan(resumeId, { viewerId, ownerId: resume.userId })
    }
  }, [status, resume, resumeId, user, authLoading, isQrVisit])

  if (status === 'notfound') {
    return (
      <StateScreen
        icon={notFoundIcon}
        title="Resume Not Found"
        text="This resume may have been deleted or the link may be invalid."
      />
    )
  }

  if (status === 'private') {
    return (
      <StateScreen
        icon={<Lock size={48} style={{ color: '#94a3b8' }} />}
        title="This Resume is Private"
        text="The owner has not shared this resume publicly. Ask them to make it public."
      />
    )
  }

  if (status === 'error') {
    return (
      <StateScreen
        icon={errorIcon}
        title="Unable to Load Resume"
        text="Please check your internet connection and try again."
      />
    )
  }

  if (status === 'loaded' && resume) {
    const config = resume.config ? { ...resume.config, name: undefined } : null
    return (
      <div className="public-resume-page">
        <div className="container public-resume-viewer">
          <div className="public-resume-frame">
            <LiveResumePreview
              config={config}
              data={resume.formData || {}}
              resumeType={resume.resumeType || 'fresher'}
            />
          </div>
        </div>
      </div>
    )
  }

  return <LoadingState />
}

function PublicResume() {
  const { resumeId } = useParams()

  if (!resumeId) {
    return (
      <StateScreen
        icon={notFoundIcon}
        title="Resume Not Found"
        text="This resume may have been deleted or the link may be invalid."
      />
    )
  }

  if (!firebaseConfigured) {
    return (
      <StateScreen
        icon={errorIcon}
        title="Unable to Load Resume"
        text="Please check your internet connection and try again."
      />
    )
  }

  return <ResumeLoader key={resumeId} resumeId={resumeId} />
}

export default PublicResume
