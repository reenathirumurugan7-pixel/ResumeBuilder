import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import LiveResumePreview from './LiveResumePreview'

// The preview page always renders at this base width and is visually scaled to
// fit, so zooming behaves like a document viewer instead of reflowing content.
const BASE_PAGE_WIDTH = 800
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

export default function ResumePreviewPanel({ config, data, resumeType, qrCodeEnabled = false, resumeId = null, panelRef = null, children }) {
  const viewportRef = useRef(null)
  // Auto-fit keeps the page width matched to the viewport; manual zooming takes
  // over once the user steps the size up or down.
  const [fitScale, setFitScale] = useState(1)
  const [zoomMode, setZoomMode] = useState('fit')
  const [customScale, setCustomScale] = useState(1)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const width = entries[0] ? entries[0].contentRect.width : el.clientWidth
      setFitScale(Math.max((width - 24) / BASE_PAGE_WIDTH, 0.2))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = zoomMode === 'fit' ? fitScale : customScale
  const percent = Math.round(scale * 100)

  const zoomBy = (delta) => {
    setZoomMode('custom')
    setCustomScale((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((prev + delta) * 100) / 100)))
  }

  return (
    <div className="editor-preview-panel">
      <div className="editor-preview-sticky">
        <div className="editor-preview-head">
          <h3 className="editor-preview-title">
            <Eye size={16} />
            Live Resume Preview
          </h3>
          <button type="button" className="editor-preview-toggle" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? <EyeOff size={16} /> : <Eye size={16} />}
            {collapsed ? 'Show Preview' : 'Hide Preview'}
          </button>
        </div>

        {!collapsed && (
          <>
            {config ? (
              <>
                <div className="editor-preview-toolbar">
                  <button
                    type="button"
                    className="editor-preview-tool"
                    onClick={() => zoomBy(-ZOOM_STEP)}
                    title="Zoom out"
                    aria-label="Zoom out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="editor-preview-zoom-label">{percent}%</span>
                  <button
                    type="button"
                    className="editor-preview-tool"
                    onClick={() => zoomBy(ZOOM_STEP)}
                    title="Zoom in"
                    aria-label="Zoom in"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <span className="editor-preview-sep" />
                  <button
                    type="button"
                    className="editor-preview-tool"
                    onClick={() => setZoomMode('fit')}
                    title="Fit to screen"
                    aria-label="Fit to screen"
                  >
                    <Maximize size={16} />
                  </button>
                </div>
                <div className="editor-preview-scaler">
                  <div className="editor-preview-viewport" ref={viewportRef}>
                    <div className="editor-preview-page" ref={panelRef} style={{ zoom: scale }}>
                      <LiveResumePreview config={config} data={data} resumeType={resumeType} qrCodeEnabled={qrCodeEnabled} resumeId={resumeId} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="editor-preview-empty">
                <p>No template selected.</p>
                <Link className="btn btn-secondary btn-sm" to="/templates">Choose a Template</Link>
              </div>
            )}
          </>
        )}

        {children}
      </div>
    </div>
  )
}