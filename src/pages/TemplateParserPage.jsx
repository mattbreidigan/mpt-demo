import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { extractPlaceholdersFromArrayBuffer, extractPlaceholdersFromDocx, inferFieldFromPlaceholder } from '../lib/placeholders'
import {
  decodeTemplateBase64,
  getSavedTemplates,
  getTemplateFile,
  getTemplateSchema,
  saveTemplateToLibrary,
  setTemplateFile,
  setTemplateFilePayload,
  setTemplateSchema,
} from '../lib/storage'

export default function TemplateParserPage() {
  const [fileName, setFileName] = useState('')
  const [schema, setSchema] = useState([])
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [manualType, setManualType] = useState('text')
  const [savedTemplates, setSavedTemplates] = useState([])
  const [selectedSavedId, setSelectedSavedId] = useState('')
  const [currentTemplate, setCurrentTemplate] = useState(null)
  const navigate = useNavigate()

  const canContinue = useMemo(() => schema.length > 0, [schema])

  useEffect(() => {
    const current = getTemplateFile()
    const templates = getSavedTemplates()
    setSavedTemplates(templates)

    if (current?.base64) {
      setCurrentTemplate(current)
      setFileName(current.name)
      setSchema(getTemplateSchema())
    } else {
      // No selected template means no detected schema.
      setTemplateSchema([])
      setSchema([])
    }
  }, [])

  function applySchemaFromKeys(keys) {
    if (keys.length === 0) {
      setTemplateSchema([])
      setSchema([])
      setError('No placeholders found in this .docx file.')
      return
    }

    const generatedSchema = keys.map(inferFieldFromPlaceholder)
    setTemplateSchema(generatedSchema)
    setSchema(generatedSchema)
    setError('')
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setIsParsing(true)
    setError('')
    setSchema([])
    setTemplateSchema([])

    try {
      const keys = await extractPlaceholdersFromDocx(file)
      const payload = await setTemplateFile(file)
      setCurrentTemplate(payload)
      applySchemaFromKeys(keys)
    } catch {
      setTemplateSchema([])
      setSchema([])
      setError('Unable to parse this .docx file. Make sure it is a valid Word template.')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleUseSavedTemplate() {
    const selected = savedTemplates.find((item) => item.id === selectedSavedId)
    if (!selected) {
      setError('Select a saved template first.')
      return
    }

    setIsParsing(true)
    setError('')
    setSchema([])
    setTemplateSchema([])

    try {
      setTemplateFilePayload(selected)
      setCurrentTemplate(selected)
      setFileName(selected.name)
      const arrayBuffer = decodeTemplateBase64(selected.base64)
      const keys = await extractPlaceholdersFromArrayBuffer(arrayBuffer)
      applySchemaFromKeys(keys)
    } catch {
      setTemplateSchema([])
      setSchema([])
      setError('Unable to parse this saved template.')
    } finally {
      setIsParsing(false)
    }
  }

  function handleSaveTemplate() {
    if (!currentTemplate?.base64) {
      setError('Upload or select a template before saving.')
      return
    }

    const saved = saveTemplateToLibrary(currentTemplate)
    const updated = getSavedTemplates()
    setSavedTemplates(updated)
    setSelectedSavedId(saved.id)
    setError('')
  }

  function updateField(nextSchema) {
    setSchema(nextSchema)
    setTemplateSchema(nextSchema)
  }

  function handleTypeChange(key, type) {
    updateField(
      schema.map((field) => {
        if (field.key !== key) return field
        if (type === 'select') {
          return { ...field, type, options: field.options?.length ? field.options : ['Pass', 'Fail', 'N/A'] }
        }
        const next = { ...field, type }
        delete next.options
        return next
      }),
    )
  }

  function handleRequiredChange(key, required) {
    updateField(schema.map((field) => (field.key === key ? { ...field, required } : field)))
  }

  function handleRemoveField(key) {
    updateField(schema.filter((field) => field.key !== key))
  }

  function handleManualAdd() {
    const key = manualKey.trim().replace(/\s+/g, '_')
    if (!key) return

    if (schema.some((field) => field.key === key)) {
      setError('Field already exists. Use a different key.')
      return
    }

    const field = inferFieldFromPlaceholder(key)
    field.type = manualType
    if (manualType === 'select') {
      field.options = ['Pass', 'Fail', 'N/A']
    } else {
      delete field.options
    }

    updateField([...schema, field].sort((a, b) => a.key.localeCompare(b.key)))
    setManualKey('')
    setManualType('text')
    setError('')
  }

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h1>Template Selection</h1>
        </div>
        <Link className="text-link" to="/">
          Back to Dashboard
        </Link>
      </div>

      <section className="card">
        <h2>Select Report Template</h2>
        <p className="muted">Upload a new .docx or choose a previously saved template.</p>

        <div className="upload-row">
          <input id="template-upload" type="file" accept=".docx" onChange={handleFileUpload} />
          <button className="button ghost" onClick={handleSaveTemplate} type="button">
            Save Selected Template
          </button>
        </div>

        <div className="upload-row" style={{ marginTop: '0.7rem' }}>
          <select value={selectedSavedId} onChange={(event) => setSelectedSavedId(event.target.value)}>
            <option value="">Select saved template</option>
            {savedTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button className="button secondary" onClick={handleUseSavedTemplate} type="button">
            Use Saved Template
          </button>
        </div>

        <p className="muted">Current template: {fileName || 'none selected'}</p>
        {isParsing ? <p className="info">Detecting placeholders...</p> : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Detected Placeholders</h2>
          <span className="pill">{schema.length} fields</span>
        </div>

        {schema.length === 0 ? (
          <p className="muted">Select a template to detect placeholders.</p>
        ) : (
          <ul className="field-list">
            {schema.map((field) => (
              <li key={field.key} className="field-item">
                <div className="field-key">
                  <code>{`{{${field.key}}}`}</code>
                </div>
                <div className="field-controls">
                  <select value={field.type} onChange={(event) => handleTypeChange(field.key, event.target.value)}>
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="date">date</option>
                    <option value="select">select</option>
                  </select>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(event) => handleRequiredChange(field.key, event.target.checked)}
                    />
                    required
                  </label>
                  <button type="button" className="button ghost" onClick={() => handleRemoveField(field.key)}>
                    remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Add Placeholder Manually</h2>
        <p className="muted">Optional: add placeholders missing from template detection.</p>
        <div className="manual-add">
          <input
            type="text"
            placeholder="placeholder_key"
            value={manualKey}
            onChange={(event) => setManualKey(event.target.value)}
          />
          <select value={manualType} onChange={(event) => setManualType(event.target.value)}>
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="date">date</option>
            <option value="select">select</option>
          </select>
          <button type="button" className="button" onClick={handleManualAdd}>
            Add Field
          </button>
        </div>
      </section>

      <section className="footer-actions">
        <button className="button" disabled={!canContinue} onClick={() => navigate('/editor')}>
          Continue to Fill Placeholders
        </button>
      </section>
    </main>
  )
}
