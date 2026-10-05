import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ArrowUp, Plus } from 'lucide-react'
import './FloatingActionButtons.css'

function FloatingActionButtons() {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [footerInView, setFooterInView] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // These buttons are fixed to the viewport, so they sit on top of whatever is
  // at the bottom of the page. Hide the stack while the footer is on screen
  // rather than covering its links. The negative bottom margin delays the swap
  // until the footer has actually intruded, not the instant it grazes the edge.
  useEffect(() => {
    const footer = document.querySelector('footer.footer')
    if (!footer || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setFooterInView(entry.isIntersecting),
      { rootMargin: '0px 0px -80px 0px' }
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  const scrollToTop = () => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  const isEditorPage = location.pathname.startsWith('/editor/')

  return (
    // `is-hidden` uses visibility: hidden, which also takes the buttons out of
    // the tab order and the accessibility tree.
    <div className={`fab-container ${footerInView ? 'is-hidden' : ''}`}>
      {showScrollTop && (
        <button
          className="fab fab-scroll-top"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ArrowUp size={20} />
        </button>
      )}
      {!isEditorPage && (
        // Client-side navigation: a plain <a href> forced a full page reload,
        // throwing away all app state and re-running every boot animation.
        <Link
          to="/resume-type"
          className="fab fab-create"
          aria-label="Create new resume"
          title="Create Resume"
        >
          <Plus size={24} />
        </Link>
      )}
    </div>
  )
}

export default FloatingActionButtons
