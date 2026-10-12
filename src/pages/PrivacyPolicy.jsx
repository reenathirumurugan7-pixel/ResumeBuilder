import { Link } from 'react-router-dom'
import ScrollReveal from '../components/ScrollReveal'
import './Legal.css'

function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="container">
          <ScrollReveal>
            <h1 className="legal-title">Privacy Policy</h1>
            <p className="legal-subtitle">
              How ResumeBuilder handles your information when you build and share resumes.
            </p>
          </ScrollReveal>
        </div>
      </div>

      <div className="legal-content">
        <div className="container">
          <ScrollReveal>
            <section className="legal-section">
              <h2>Information stored on your device</h2>
              <p>
                Your resume drafts, template preferences, theme, and app settings are kept in
                your browser&apos;s local storage. They stay on the device you use and are not
                sent anywhere unless you sign in and save a resume to your account.
              </p>
            </section>

            <section className="legal-section">
              <h2>Information stored in your account</h2>
              <p>
                When you are signed in, saved resumes are stored in ResumeBuilder&apos;s cloud
                database alongside your account identifier so they can be restored on another
                device. Feedback submitted through the Feedback page is stored so the team can
                read and act on it.
              </p>
            </section>

            <section className="legal-section">
              <h2>Sharing</h2>
              <p>
                Resumes are private by default. Only when you explicitly make a resume public
                from the Resume Vault can anyone with the link view it. Download and share
                counts are tracked for public resumes so you can see how each one performs.
              </p>
            </section>

            <section className="legal-section">
              <h2>Contact</h2>
              <p>
                Questions about this policy? Reach us through the{' '}
                <Link to="/feedback" className="legal-link">Feedback page</Link>.
              </p>
            </section>

            <p className="legal-updated">This policy was last updated in {new Date().getFullYear()}.</p>
          </ScrollReveal>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy