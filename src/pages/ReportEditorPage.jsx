import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { exportDocx, exportPdf } from '../lib/exporters'
import { getReportDraft, getTemplateFile, getTemplateSchema, setReportDraft } from '../lib/storage'

function renderField(field, value, onChange) {
  if (field.key === 'tests') {
    return (
      <textarea
        id={field.key}
        rows={4}
        value={value ?? ''}
        onChange={(event) => onChange(field.key, event.target.value)}
        placeholder={'1|Burst Integrity|Pass\n2|Dye Penetration|Fail'}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select id={field.key} value={value ?? ''} onChange={(event) => onChange(field.key, event.target.value)}>
        <option value="">Select...</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  const type = field.type === 'number' || field.type === 'date' ? field.type : 'text'

  return (
    <input
      id={field.key}
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange(field.key, event.target.value)}
    />
  )
}

export default function ReportEditorPage() {
  const [schema, setSchema] = useState([])
  const [formValues, setFormValues] = useState({})
  const [templateFile, setTemplateFileState] = useState(null)
  const [savedAt, setSavedAt] = useState('')
  const [error, setError] = useState('')
  const [exportMessage, setExportMessage] = useState('')

  useEffect(() => {
    setSchema(getTemplateSchema())
    setFormValues(getReportDraft())
    setTemplateFileState(getTemplateFile())
  }, [])

  function updateValue(key, value) {
    const next = { ...formValues, [key]: value }
    setFormValues(next)
  }

  function handleSaveDraft() {
    setReportDraft(formValues)
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setError('')
    setExportMessage('Draft saved.')
  }

  const missingRequired = useMemo(
    () => schema.filter((field) => field.required && !formValues[field.key]),
    [schema, formValues],
  )
  const completionPercent = schema.length === 0 ? 0 : Math.round(((schema.length - missingRequired.length) / schema.length) * 100)
  const canExportDocx = schema.length > 0 && missingRequired.length === 0
  const canExportPdf = schema.length > 0 && missingRequired.length === 0

  function handleExportDocx() {
    setError('')
    setExportMessage('')

    if (missingRequired.length > 0) {
      setError('Complete all required fields before exporting.')
      return
    }

    if (!templateFile?.base64) {
      setError('No template loaded. Upload a .docx in Template Parser before DOCX export.')
      return
    }

    try {
      exportDocx(templateFile, formValues)
      setExportMessage('DOCX exported successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  function handleExportPdf() {
    setError('')
    setExportMessage('')

    if (missingRequired.length > 0) {
      setError('Complete all required fields before exporting.')
      return
    }

    try {
      exportPdf(formValues)
      setExportMessage('PDF exported successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h1>Report Editor</h1>
        </div>
        <Link className="text-link" to="/">
          Back to Dashboard
        </Link>
      </div>

      <div className="editor-layout">
        <section className="card">
          <div className="section-header">
            <h2>Generated Form</h2>
            <span className="pill">{schema.length} fields</span>
          </div>
          {schema.length === 0 ? (
            <p className="muted">No schema found. Go to Template Parser and upload a template first.</p>
          ) : (
            <form className="form-grid">
              {schema.map((field) => (
                <label className="field" key={field.key} htmlFor={field.key}>
                  <span>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  {renderField(field, formValues[field.key], updateValue)}
                  {field.key === 'tests' ? (
                    <small className="muted">
                      Enter one row per line using `index|name|result` or `name|result`.
                    </small>
                  ) : null}
                </label>
              ))}
            </form>
          )}
        </section>

        <aside className="card status-card">
          <h2>Progress</h2>
          <p className="muted">Completion: {completionPercent}%</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${completionPercent}%` }} />
          </div>
          <p className="muted">Missing required fields: {missingRequired.length}</p>
          {savedAt ? <p className="info">Saved at {savedAt}</p> : null}
          <p className="muted">Template loaded: {templateFile?.name || 'no .docx uploaded yet'}</p>
          {error ? <p className="error">{error}</p> : null}
          {exportMessage ? <p className="info">{exportMessage}</p> : null}
          <div className="action-stack">
            <button type="button" className="button ghost" onClick={handleSaveDraft}>
              Save Draft
            </button>
            <button type="button" className="button" onClick={handleExportDocx} disabled={!canExportDocx}>
              Export DOCX
            </button>
            <button type="button" className="button secondary" onClick={handleExportPdf} disabled={!canExportPdf}>
              Export PDF
            </button>
          </div>
          {missingRequired.length > 0 ? (
            <div className="missing-under-buttons">
              <p className="muted">Unfilled required inputs:</p>
              <ul className="mini-list">
                {missingRequired.map((field) => (
                  <li key={field.key}>{field.label}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="info">All required fields complete.</p>
          )}
          {!templateFile?.base64 ? (
            <p className="muted">Go to Template Parser and upload a .docx before export.</p>
          ) : null}
        </aside>
      </div>
    </main>
  )
}
