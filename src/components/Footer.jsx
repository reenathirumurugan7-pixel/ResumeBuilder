import { Link } from 'react-router-dom'
import { useIsAdmin } from '../hooks/useIsAdmin'
import './Footer.css'

function Footer() {
  const currentYear = new Date().getFullYear()
  const { isAdmin } = useIsAdmin()

  // The Dashboard quick link follows the same rule as the navigation: admins are
  // sent to /admin (guarded by AdminRoute), everyone else to /dashboard.
  const dashboardPath = isAdmin ? '/admin' : '/dashboard'

  return (
    <footer className="footer">
      <div className="footer-container container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <span className="footer-logo-icon">RB</span>
              <span className="footer-logo-text">ResumeBuilder</span>
            </Link>
            <p className="footer-tagline">
              Build professional, ATS-friendly resumes in minutes.
              Stand out from the crowd.
            </p>
          </div>

          <div className="footer-links-group">
            <h4 className="footer-heading">Product</h4>
            <ul className="footer-list">
              <li><Link to="/templates">Templates</Link></li>
              <li><Link to="/features">Features</Link></li>
              <li><Link to="/resume-type">Create Resume</Link></li>
              <li><Link to={dashboardPath}>Dashboard</Link></li>
            </ul>
          </div>

          <div className="footer-links-group">
            <h4 className="footer-heading">Company</h4>
            <ul className="footer-list">
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/feedback">Contact</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="footer-links-group">
            <h4 className="footer-heading">Resources</h4>
            <ul className="footer-list">
              <li><span className="footer-placeholder" title="Coming soon">Resume Tips</span></li>
              <li><span className="footer-placeholder" title="Coming soon">Career Guide</span></li>
              <li><span className="footer-placeholder" title="Coming soon">Interview Prep</span></li>
              <li><span className="footer-placeholder" title="Coming soon">Blog</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {currentYear} ResumeBuilder. All rights reserved.
          </p>
          <p className="footer-made">
            Made with care for your career growth.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
