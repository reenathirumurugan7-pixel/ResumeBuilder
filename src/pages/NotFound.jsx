import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import ScrollReveal from '../components/ScrollReveal'
import './NotFound.css'

// Catch-all route. Without it, an unknown path (a stale bookmark, a mistyped
// URL, or the old `/public/:id` shape that predates `/resume/:resumeId`) matches
// no route at all and React Router renders an entirely blank page below the
// navbar, which reads as a broken site rather than a wrong link.
function NotFound() {
  return (
    <div className="notfound-page">
      <div className="container">
        <ScrollReveal>
          <div className="notfound-inner">
            <div className="notfound-icon" aria-hidden="true">
              <Compass size={44} />
            </div>
            <p className="notfound-code">404</p>
            <h1 className="notfound-title">This page doesn't exist</h1>
            <p className="notfound-text">
              The link may be out of date, or the address may have a typo. If you were trying to open a shared
              resume, use the full link its owner shared with you.
            </p>
            <div className="notfound-actions">
              <Link to="/" className="btn btn-primary">Back to Home</Link>
              <Link to="/resume-vault" className="btn btn-secondary">Resume Vault</Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  )
}

export default NotFound