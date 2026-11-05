import { useRef, useState } from 'react'
import { User, Upload, Trash2 } from 'lucide-react'
import './PersonalInfo.css'
import { validatePhotoFile, normalizePhoto } from '../utils/photo'
import { capitalizeInputValue } from '../utils/capitalize'

const CAPITALIZED_FIELDS = new Set(['fullName', 'location'])

function PersonalInfo({ data, onChange, errors, onPhotoChange }) {
  const fileInputRef = useRef(null)
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)

  const handleChange = (e) => {
    const value = CAPITALIZED_FIELDS.has(e.target.name)
      ? capitalizeInputValue(e)
      : e.target.value
    onChange({ ...data, [e.target.name]: value })
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    setPhotoError('')
    if (!file) return
    const validation = validatePhotoFile(file)
    if (!validation.ok) {
      setPhotoError(validation.message)
      return
    }
    try {
      setPhotoLoading(true)
      const photoData = await normalizePhoto(file)
      if (onPhotoChange) {
        onPhotoChange(photoData)
      }
    } catch (err) {
      setPhotoError(err.message || 'That photo could not be used.')
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleRemovePhoto = () => {
    setPhotoError('')
    if (onPhotoChange) {
      onPhotoChange(null)
    }
  }

  const openFilePicker = () => {
    fileInputRef.current && fileInputRef.current.click()
  }

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <User size={20} />
        Personal Information
      </h3>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input
            type="text"
            name="fullName"
            className={`form-input ${errors.fullName ? 'error' : ''}`}
            placeholder="John Anderson"
            value={data.fullName || ''}
            onChange={handleChange}
          />
          {errors.fullName && <span className="form-error">{errors.fullName}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Email *</label>
          <input
            type="email"
            name="email"
            className={`form-input ${errors.email ? 'error' : ''}`}
            placeholder="john@example.com"
            value={data.email || ''}
            onChange={handleChange}
          />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Phone *</label>
          <input
            type="tel"
            name="phone"
            className={`form-input ${errors.phone ? 'error' : ''}`}
            placeholder="+1 234 567 890"
            value={data.phone || ''}
            onChange={handleChange}
          />
          {errors.phone && <span className="form-error">{errors.phone}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Location</label>
          <input
            type="text"
            name="location"
            className="form-input"
            placeholder="City, State"
            value={data.location || ''}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label">LinkedIn URL</label>
          <input
            type="url"
            name="linkedin"
            className="form-input"
            placeholder="https://linkedin.com/in/yourprofile"
            value={data.linkedin || ''}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label">GitHub URL</label>
          <input
            type="url"
            name="github"
            className="form-input"
            placeholder="https://github.com/yourusername"
            value={data.github || ''}
            onChange={handleChange}
          />
        </div>

        <div className="form-group form-group-full">
          <label className="form-label">Live Portfolio / Project URL</label>
          <input
            type="url"
            name="portfolio"
            className={`form-input ${errors.portfolio ? 'error' : ''}`}
            placeholder="https://yourportfolio.com"
            value={data.portfolio || ''}
            onChange={handleChange}
          />
          {errors.portfolio && <span className="form-error">{errors.portfolio}</span>}
        </div>

        <div className="form-group form-group-full">
          <label className="form-label">Profile Picture</label>
          <div className="profile-photo-upload">
            {data.photo ? (
              <div className="profile-photo-preview">
                <img src={data.photo} alt="Profile" />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRemovePhoto}
                >
                  <Trash2 size={16} />
                  Remove Photo
                </button>
              </div>
            ) : (
              <div className="profile-photo-placeholder">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openFilePicker}
                  disabled={photoLoading}
                >
                  <Upload size={16} />
                  {photoLoading ? 'Uploading...' : 'Upload Photo'}
                </button>
                <p className="profile-photo-hint">
                  JPG/JPEG, PNG, WebP • Max 2 MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
            {(photoError || errors.photo) && (
              <span className="form-error">{photoError || errors.photo}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PersonalInfo
