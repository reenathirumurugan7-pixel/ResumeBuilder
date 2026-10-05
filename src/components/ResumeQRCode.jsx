import { QRCodeSVG } from 'qrcode.react'
import './ResumeQRCode.css'

function ResumeQRCode({ url, size = 80, className = '', compact = false }) {
  if (!url) return null
  return (
    <div className={`resume-qr-code ${compact ? 'resume-qr-compact' : ''} ${className}`} title="Scan to view resume">
      <QRCodeSVG
        value={url}
        size={size}
        bgColor="#ffffff"
        fgColor="#000000"
        level="M"
        aria-label="QR Code to resume"
      />
    </div>
  )
}

export default ResumeQRCode
