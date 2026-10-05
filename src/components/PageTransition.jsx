import { cloneElement, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './PageTransition.css'

const reducedMotionQuery =
  typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-reduced-motion: reduce)')
    : null

function PageTransition({ children }) {
  const location = useLocation()
  const [prev, setPrev] = useState({
    pathname: location.pathname,
    location,
    children,
  })
  const [exit, setExit] = useState(null)

  const reducedMotion = reducedMotionQuery
    ? reducedMotionQuery.matches
    : false

  if (prev.pathname !== location.pathname) {
    if (!reducedMotion) {
      setExit({ location: prev.location, children: prev.children })
    }
    setPrev({ pathname: location.pathname, location, children })
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (!exit) return
    const t = window.setTimeout(() => setExit(null), 500)
    return () => window.clearTimeout(t)
  }, [exit])

  return (
    <div className="page-transition">
      <div className={exit ? 'pt-enter pt-enter--active' : 'pt-enter'}>
        {children}
      </div>
      {exit && (
        <div
          className="pt-exit"
          aria-hidden="true"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && e.animationName !== 'none') {
              setExit(null)
            }
          }}
        >
          {cloneElement(exit.children, { location: exit.location })}
        </div>
      )}
    </div>
  )
}

export default PageTransition