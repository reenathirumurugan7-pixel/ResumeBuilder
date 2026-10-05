import { useState } from 'react'
import { CheckCircle, XCircle, Download, FileText, Printer } from 'lucide-react'
import { generatePDF } from '../utils/pdfExport'
import { generateWord } from '../utils/wordExport'
import { printResume } from '../utils/printResume'
import './ExportSection.css'

function ExportSection({ formData, resumeType }) {
  const [loading, setLoading] = useState(null)
  const [notification, setNotification] = useState(null)

  const showNotification = (message, type) => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleExportPDF = async () => {
    setLoading('pdf')
    try {
      const fileName = generatePDF(formData, resumeType)
      showNotification(`PDF exported: ${fileName}`, 'success')
    } catch {
      showNotification('Failed to generate PDF. Please try again.', 'error')
    } finally {
      setLoading(null)
    }
  }

    const handleExportWord = async () => {
      setLoading('word')
      try {
        await generateWord(formData, resumeType)
        showNotification(`Word document exported successfully`, 'success')
      } catch {
        showNotification('Failed to generate Word document. Please try again.', 'error')
      } finally {
        setLoading(null)
      }
    }

  const handlePrint = () => {
    setLoading('print')
    try {
      printResume(formData, resumeType)
      showNotification('Print dialog opened.', 'success')
    } catch {
      showNotification('Failed to open print dialog.', 'error')
    } finally {
      setLoading(null)
    }
  }

  const handleDownload = () => {
    setLoading('download')
    try {
      const fileName = generatePDF(formData, resumeType)
      showNotification(`Downloaded: ${fileName}`, 'success')
    } catch {
      showNotification('Failed to download. Please try again.', 'error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="export-section">
      {notification && (
        <div className={`export-notification ${notification.type}`}>
          {notification.type === 'success' ? (
            <CheckCircle size={18} strokeWidth={2.5} />
          ) : (
            <XCircle size={18} strokeWidth={2.5} />
          )}
          {notification.message}
        </div>
      )}

      <div className="export-success-banner">
        <CheckCircle size={24} strokeWidth={2.5} />
        <div>
          <h3 className="export-success-title">Resume Created Successfully</h3>
          <p className="export-success-text">Your resume has been created successfully. You can now export or download it.</p>
        </div>
      </div>

      <div className="export-card">
        <h3 className="export-card-title">
          <Download size={20} />
          Export Resume
        </h3>

        <div className="export-buttons">
          <button
            className="export-btn export-btn-pdf"
            onClick={handleExportPDF}
            disabled={loading !== null}
          >
            {loading === 'pdf' ? (
              <span className="export-btn-loading">
                <span className="export-spinner"></span>
                Generating PDF...
              </span>
            ) : (
              <>
                <FileText size={18} />
                Export PDF
              </>
            )}
          </button>

          <button
            className="export-btn export-btn-word"
            onClick={handleExportWord}
            disabled={loading !== null}
          >
            {loading === 'word' ? (
              <span className="export-btn-loading">
                <span className="export-spinner"></span>
                Generating Word...
              </span>
            ) : (
              <>
                <FileText size={18} />
                Export Word
              </>
            )}
          </button>

          <button
            className="export-btn export-btn-print"
            onClick={handlePrint}
            disabled={loading !== null}
          >
            {loading === 'print' ? (
              <span className="export-btn-loading">
                <span className="export-spinner"></span>
                Opening...
              </span>
            ) : (
              <>
                <Printer size={18} />
                Print Resume
              </>
            )}
          </button>

          <button
            className="export-btn export-btn-download"
            onClick={handleDownload}
            disabled={loading !== null}
          >
            {loading === 'download' ? (
              <span className="export-btn-loading">
                <span className="export-spinner"></span>
                Downloading...
              </span>
            ) : (
              <>
                <Download size={18} />
                Download Resume
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportSection
