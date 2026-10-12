import { LayoutTemplate } from 'lucide-react'
import templates from '../../data/templates'
import { AdminSectionHead } from './State'
import './Admin.css'

// The template catalogue is shipped as static data in src/data/templates.js, so
// this page is a read-only inventory. There is no Firestore read here.
function AdminTemplates() {
  return (
    <div>
      <header className="admin-header">
        <div className="admin-header-text">
          <p className="admin-eyebrow">
            <LayoutTemplate size={14} /> Admin templates
          </p>
          <h1 className="admin-title">Template Catalogue</h1>
          <p className="admin-subtitle">
            {templates.length} templates compiled into this build. This is read from the client
            bundle and needs no server or database access.
          </p>
        </div>
      </header>

      <section className="admin-section" aria-labelledby="admin-templates-title">
        <AdminSectionHead icon={LayoutTemplate} title={`Templates (${templates.length})`} note="Static data" />
        <div className="admin-table" role="table">
          <div className="admin-table-head admin-th-5" role="row">
            <span role="columnheader">Template</span>
            <span role="columnheader">Categories</span>
            <span role="columnheader">Layout</span>
            <span role="columnheader">Added</span>
            <span role="columnheader">ATS field</span>
          </div>
          {templates.map((template) => (
            <div className="admin-table-row admin-th-5" role="row" key={template.id}>
              <span className="admin-table-name" role="cell" data-label="Template">
                {template.name}
                <span className="admin-row-meta">{template.id}</span>
              </span>
              <span role="cell" data-label="Categories">
                {Array.isArray(template.category) ? template.category.join(', ') : '—'}
              </span>
              <span role="cell" data-label="Layout">
                {template.layout || '—'}
              </span>
              <span role="cell" data-label="Added">
                {template.createdAt || '—'}
              </span>
              <span role="cell" data-label="ATS field">{template.atsScore ?? '—'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default AdminTemplates