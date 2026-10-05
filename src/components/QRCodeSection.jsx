import { QrCode } from 'lucide-react'
import './QRCodeSection.css'

function QRCodeSection({ enabled, onToggle }) {
  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <QrCode size={20} />
        QR Code
      </h3>

      <div className="qr-setting-row">
        <div className="qr-setting-info">
          <span className="qr-setting-label">Enable QR Code</span>
          <span className="qr-setting-hint">
            {enabled
              ? 'A QR code will appear in the top-right corner of this resume and its PDF.'
              : 'Turn on to add a scannable QR code that links to this resume.'}
          </span>
        </div>
        <button
          type="button"
          className={`qr-toggle ${enabled ? 'qr-toggle-on' : ''}`}
          onClick={() => onToggle(!enabled)}
          role="switch"
          aria-checked={enabled}
          aria-label="Enable QR Code"
        >
          <span className="qr-toggle-track">
            <span className="qr-toggle-thumb"></span>
          </span>
          <span className="qr-toggle-text">{enabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  )
}

export default QRCodeSection
