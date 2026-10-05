import './Skeleton.css'

function Skeleton({ width, height, borderRadius, className = '', style }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height: height || '16px',
        borderRadius: borderRadius || '6px',
        ...style,
      }}
    />
  )
}

function SkeletonText({ lines = 3, lastWidth = '60%', gap = '10px', className = '' }) {
  return (
    <div className={`skeleton-text ${className}`} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height="12px"
          width={i === lines - 1 ? lastWidth : '100%'}
          borderRadius="4px"
        />
      ))}
    </div>
  )
}

function SkeletonCard({ className = '' }) {
  return (
    <div className={`skeleton-card ${className}`}>
      <Skeleton height="140px" borderRadius="12px 12px 0 0" style={{ marginBottom: 0 }} />
      <div style={{ padding: '16px' }}>
        <Skeleton height="18px" width="70%" borderRadius="4px" style={{ marginBottom: '10px' }} />
        <SkeletonText lines={2} lastWidth="40%" />
      </div>
    </div>
  )
}

function SkeletonResumeCard({ className = '' }) {
  return (
    <div className={`skeleton-resume-card ${className}`}>
      <div className="skeleton-resume-card-preview">
        <div className="skeleton-resume-card-header" />
        <div className="skeleton-resume-card-body">
          <Skeleton height="8px" width="60%" borderRadius="3px" style={{ marginBottom: '8px' }} />
          <Skeleton height="6px" width="100%" borderRadius="2px" style={{ marginBottom: '5px' }} />
          <Skeleton height="6px" width="85%" borderRadius="2px" style={{ marginBottom: '5px' }} />
          <Skeleton height="6px" width="70%" borderRadius="2px" style={{ marginBottom: '12px' }} />
          <Skeleton height="8px" width="40%" borderRadius="3px" style={{ marginBottom: '8px' }} />
          <Skeleton height="6px" width="95%" borderRadius="2px" style={{ marginBottom: '5px' }} />
          <Skeleton height="6px" width="80%" borderRadius="2px" />
        </div>
      </div>
      <div className="skeleton-resume-card-info">
        <Skeleton height="16px" width="55%" borderRadius="4px" style={{ marginBottom: '8px' }} />
        <Skeleton height="12px" width="40%" borderRadius="3px" style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '6px' }}>
          <Skeleton height="24px" width="60px" borderRadius="20px" />
          <Skeleton height="24px" width="50px" borderRadius="20px" />
        </div>
      </div>
    </div>
  )
}

function SkeletonResume({ className = '' }) {
  return (
    <div className={`skeleton-resume ${className}`}>
      <div className="skeleton-resume-header">
        <Skeleton height="24px" width="40%" borderRadius="4px" style={{ marginBottom: '8px' }} />
        <Skeleton height="12px" width="55%" borderRadius="3px" style={{ marginBottom: '4px' }} />
        <Skeleton height="10px" width="45%" borderRadius="3px" />
      </div>
      <div className="skeleton-resume-section">
        <Skeleton height="14px" width="30%" borderRadius="3px" style={{ marginBottom: '12px' }} />
        <SkeletonText lines={3} lastWidth="75%" gap="7px" />
      </div>
      <div className="skeleton-resume-section">
        <Skeleton height="14px" width="25%" borderRadius="3px" style={{ marginBottom: '12px' }} />
        <Skeleton height="12px" width="50%" borderRadius="3px" style={{ marginBottom: '4px' }} />
        <SkeletonText lines={2} lastWidth="60%" gap="7px" />
      </div>
      <div className="skeleton-resume-section">
        <Skeleton height="14px" width="20%" borderRadius="3px" style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Skeleton height="26px" width="70px" borderRadius="20px" />
          <Skeleton height="26px" width="80px" borderRadius="20px" />
          <Skeleton height="26px" width="60px" borderRadius="20px" />
          <Skeleton height="26px" width="90px" borderRadius="20px" />
        </div>
      </div>
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonResumeCard, SkeletonResume }
export default Skeleton
