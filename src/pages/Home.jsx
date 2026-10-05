import { Link } from 'react-router-dom'
import {
  Briefcase,
  Download,
  Folder,
  GraduationCap,
  LayoutGrid,
  LayoutTemplate,
  Pencil,
  PencilLine,
  Save,
  Share2,
  Shield,
  Star,
  Target,
} from 'lucide-react'
import ScrollReveal from '../components/ScrollReveal'
import Hero from '../components/Hero'
import FeatureCard from '../components/FeatureCard'
import './Home.css'

function Home() {
  const features = [
    {
      icon: <LayoutGrid size={28} />,
      title: 'Professional Templates',
      description: 'Choose from multiple modern resume designs that capture attention and make a lasting impression.',
    },
    {
      icon: <Shield size={28} />,
      title: 'ATS Friendly',
      description: 'Create resumes that are optimized for Applicant Tracking Systems, ensuring your resume gets seen.',
    },
    {
      icon: <Pencil size={28} />,
      title: 'Easy Resume Builder',
      description: 'Enter your information through a simple, intuitive resume editor. No design skills required.',
    },
    {
      icon: <Star size={28} />,
      title: 'Resume Enhancement',
      description: 'Improve your career objective, summary, projects, and experience with AI-powered suggestions.',
    },
    {
      icon: <Download size={28} />,
      title: 'PDF Download',
      description: 'Download your finished resume as a high-quality PDF, ready to send to employers.',
    },
    {
      icon: <Save size={28} />,
      title: 'Auto Save',
      description: 'Automatically save your resume information. Never lose your progress again.',
    },
  ]

  // Kept deliberately short: the long-form product story lives on /about, which
  // this section links to, so the landing page is a summary rather than a copy.
  const values = [
    {
      icon: <LayoutTemplate size={22} strokeWidth={1.75} />,
      title: '50+ Templates',
      description: 'Pick a professional layout and customise the colours to suit your field.',
    },
    {
      icon: <PencilLine size={22} strokeWidth={1.75} />,
      title: 'Guided Editor',
      description: 'Fill in each section with prompts and live preview. No design skills needed.',
    },
    {
      icon: <Share2 size={22} strokeWidth={1.75} />,
      title: 'Share Anywhere',
      description: 'Export a polished PDF or Word file, or publish a public link with a QR code.',
    },
  ]

  const resumePaths = [
    {
      to: '/resume-type',
      icon: <GraduationCap size={40} strokeWidth={1.5} />,
      title: 'Fresher Resume',
      description: 'For students and recent graduates building your first resume.',
      cta: 'Create Fresher Resume',
    },
    {
      to: '/resume-type',
      icon: <Briefcase size={40} strokeWidth={1.5} />,
      title: 'Experienced Resume',
      description: 'For working professionals showcasing your career and skills.',
      cta: 'Create Experienced Resume',
    },
    {
      to: '/resume-vault',
      icon: <Folder size={40} strokeWidth={1.5} />,
      title: 'Resume Vault',
      description: 'Access and manage all your saved resumes.',
      cta: 'Open Resume Vault',
    },
    {
      to: '/job-matcher',
      icon: <Target size={40} strokeWidth={1.5} />,
      title: 'Job Matcher',
      description: 'Compare a resume with a job description and find the skills you are missing.',
      cta: 'Open Job Matcher',
    },
  ]

  const steps = [
    {
      number: '01',
      title: 'Choose a Template',
      description: 'Select a professional resume template that matches your style and industry.',
    },
    {
      number: '02',
      title: 'Enter Your Details',
      description: 'Add your education, skills, projects, and experience through our easy editor.',
    },
    {
      number: '03',
      title: 'Download',
      description: 'Preview your resume in real-time and download it as a polished PDF.',
    },
  ]

  return (
    <div className="home-page">
      <Hero />

      <section className="about-section">
        <div className="container">
          <ScrollReveal>
            <h2 className="section-title">Why ResumeBuilder</h2>
            <p className="section-subtitle">
              A modern platform for students, freshers and professionals to build impressive,
              ATS-friendly resumes in a single sitting.
            </p>
          </ScrollReveal>
          <div className="home-value-grid">
            {values.map((value, index) => (
              <ScrollReveal key={value.title} delay={index * 80}>
                <div className="home-value-card">
                  <span className="home-value-icon">{value.icon}</span>
                  <h3 className="home-value-title">{value.title}</h3>
                  <p className="home-value-desc">{value.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={240}>
            <p className="about-text">
              Every resume is auto-saved, kept in your{' '}
              <Link to="/resume-vault">Resume Vault</Link>, and scored for ATS compatibility.{' '}
              <Link to="/about">Learn more about ResumeBuilder</Link>.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="home-choose-section" id="create">
        <div className="container">
          <ScrollReveal>
            <h2 className="section-title">Choose Your Resume Path</h2>
            <p className="section-subtitle">
              Start fresh, showcase your experience, or manage your saved resumes.
            </p>
          </ScrollReveal>
          <div className="home-choose-grid">
            {resumePaths.map((path, index) => (
              <ScrollReveal key={path.title} delay={index * 100}>
                <Link to={path.to} className={`home-choose-card home-choose-card--${index + 1}`}>
                  <div className="home-choose-icon">{path.icon}</div>
                  <h3 className="home-choose-title">{path.title}</h3>
                  <p className="home-choose-desc">{path.description}</p>
                  <span className="home-choose-link">{path.cta}</span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="container">
          <ScrollReveal>
            <h2 className="section-title">Everything You Need</h2>
            <p className="section-subtitle">
              Powerful features to help you create a resume that stands out and gets results.
            </p>
          </ScrollReveal>
          <div className="features-grid">
            {features.map((feature, index) => (
              <ScrollReveal key={index} delay={index * 80}>
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="how-it-works-section" id="how-it-works">
        <div className="container">
          <ScrollReveal>
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              Three simple steps to create your professional resume.
            </p>
          </ScrollReveal>
          <div className="steps-grid">
            {steps.map((step, index) => (
              <ScrollReveal key={index} delay={index * 120}>
                <div className="step-card">
                  <div className="step-number">{step.number}</div>
                  <div className={`step-connector ${index === steps.length - 1 ? 'hidden' : ''}`}></div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-description">{step.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <ScrollReveal>
            <div className="cta-card">
              <div className="cta-bg-shapes">
                <div className="cta-shape cta-shape-1"></div>
                <div className="cta-shape cta-shape-2"></div>
              </div>
              <h2 className="cta-title">Ready to Build Your Resume?</h2>
              <p className="cta-description">
                Join thousands of professionals who have landed their dream jobs with ResumeBuilder.
              </p>
              <div className="cta-buttons">
                <Link to="/resume-type" className="btn btn-primary">
                  Get Started &mdash; It&apos;s Free
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default Home
