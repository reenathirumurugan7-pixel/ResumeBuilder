import { Link } from 'react-router-dom'
import { Smile, LayoutGrid, Shield, Clock, Eye, Download, Star } from 'lucide-react'
import ScrollReveal from '../components/ScrollReveal'
import './About.css'

function About() {
  const reasons = [
    {
      icon: <Smile size={24} />,
      title: 'Easy to Use',
      description: 'Intuitive interface that makes resume building simple and enjoyable.',
    },
    {
      icon: <LayoutGrid size={24} />,
      title: 'Professional Templates',
      description: 'Choose from modern, ATS-optimized templates designed by experts.',
    },
    {
      icon: <Shield size={24} />,
      title: 'ATS-Friendly',
      description: 'Resumes that pass Applicant Tracking Systems and reach hiring managers.',
    },
    {
      icon: <Clock size={24} />,
      title: 'Fast Creation',
      description: 'Build a professional resume in minutes, not hours.',
    },
    {
      icon: <Eye size={24} />,
      title: 'Live Preview',
      description: 'See your resume update in real-time as you type.',
    },
    {
      icon: <Download size={24} />,
      title: 'Easy PDF Download',
      description: 'Download your finished resume as a polished PDF instantly.',
    },
  ]

  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="container">
          <ScrollReveal>
            <h1 className="about-title">About ResumeBuilder</h1>
            <p className="about-description">
              ResumeBuilder helps students, freshers, and professionals create modern,
              professional, and ATS-friendly resumes easily.
            </p>
          </ScrollReveal>
        </div>
      </div>

      <section className="about-mission">
        <div className="container">
          <ScrollReveal>
            <div className="mission-card">
              <div className="mission-icon">
                <Star size={32} strokeWidth={1.5} />
              </div>
              <h2 className="mission-title">Our Mission</h2>
              <p className="mission-text">
                Help job seekers create professional resumes quickly and confidently.
                We believe everyone deserves a great resume that opens doors to
                opportunities.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="about-why">
        <div className="container">
          <ScrollReveal>
            <h2 className="section-title">Why ResumeBuilder?</h2>
            <p className="section-subtitle">
              Everything you need to create a resume that stands out.
            </p>
          </ScrollReveal>
          <div className="reasons-grid">
            {reasons.map((reason, index) => (
              <ScrollReveal key={index} delay={index * 80}>
                <div className="reason-card">
                  <div className="reason-icon">{reason.icon}</div>
                  <h3 className="reason-title">{reason.title}</h3>
                  <p className="reason-description">{reason.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="container">
          <ScrollReveal>
            <div className="about-cta-card">
              <h2 className="about-cta-title">Ready to Build Your Resume?</h2>
              <p className="about-cta-text">
                Start creating your professional resume today. It&apos;s free and takes just minutes.
              </p>
              <Link to="/resume-type" className="btn btn-primary about-cta-btn">
                Create Your Resume
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default About
