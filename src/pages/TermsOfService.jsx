import { Link } from 'react-router-dom'
import ScrollReveal from '../components/ScrollReveal'
import './Legal.css'

function TermsOfService() {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="container">
          <ScrollReveal>
            <h1 className="legal-title">Terms of Service</h1>
            <p className="legal-subtitle">
              The terms that apply when you use ResumeBuilder.
            </p>
          </ScrollReveal>
        </div>
      </div>

      <div className="legal-content">
        <div className="container">
          <ScrollReveal>
            <section className="legal-section">
              <h2>Acceptance of terms</h2>
              <p>
                By using ResumeBuilder you agree to these terms. If you do not agree with any
                part of them, please stop using the service.
              </p>
            </section>

            <section className="legal-section">
              <h2>The service</h2>
              <p>
                ResumeBuilder lets you create, edit, download, and share resumes. Templates,
                features, and availability may change over time as the service evolves.
              </p>
            </section>

            <section className="legal-section">
              <h2>Your responsibilities</h2>
              <ul>
                <li>Provide accurate information in your resumes.</li>
                <li>Only publish content you own or have the right to share.</li>
                <li>Do not use the service for unlawful or misleading purposes.</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>No warranty</h2>
              <p>
                The service is provided as-is, without warranties of any kind. While a resume
                may be designed to be ATS-friendly, ResumeBuilder does not guarantee any
                application outcome.
              </p>
            </section>

            <section className="legal-section">
              <h2>Contact</h2>
              <p>
                Questions about these terms? Reach us through the{' '}
                <Link to="/feedback" className="legal-link">Feedback page</Link>.
              </p>
            </section>

            <p className="legal-updated">These terms were last updated in {new Date().getFullYear()}.</p>
          </ScrollReveal>
        </div>
      </div>
    </div>
  )
}

export default TermsOfService