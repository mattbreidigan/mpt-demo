import { useEffect, useMemo, useState } from 'react'
import { exportDocx, exportPdf } from '../lib/exporters'
import { extractPlaceholdersFromArrayBuffer, extractPlaceholdersFromDocx, inferFieldFromPlaceholder } from '../lib/placeholders'
import {
  decodeTemplateBase64,
  getReportDraft,
  getSavedDrafts,
  getSavedTemplates,
  getTemplateFile,
  getTemplateSchema,
  saveDraftToLibrary,
  saveTemplateToLibrary,
  setReportDraft,
  setTemplateFile,
  setTemplateFilePayload,
  setTemplateSchema,
} from '../lib/storage'

function renderField(field, value, onChange) {
  const type = field.type === 'date' || field.type === 'time' ? field.type : 'text'

  return (
    <input
      id={field.key}
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange(field.key, event.target.value)}
    />
  )
}

export default function WorkflowPage() {
  const [activeTab, setActiveTab] = useState('template')
  const [schema, setSchema] = useState([])
  const [uploadDetectedSchema, setUploadDetectedSchema] = useState([])
  const [savedDetectedSchema, setSavedDetectedSchema] = useState([])
  const [formValues, setFormValues] = useState({})
  const [templateFile, setTemplateFileState] = useState(null)
  const [savedTemplates, setSavedTemplates] = useState([])
  const [savedDrafts, setSavedDrafts] = useState([])
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState('')
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [fillMode, setFillMode] = useState('manual')
  const [templateSourceMode, setTemplateSourceMode] = useState('upload')
  const [draftName, setDraftName] = useState('')
  const [fileName, setFileName] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [manualType, setManualType] = useState('text')
  const [isParsing, setIsParsing] = useState(false)
  const [attemptedFillConfirm, setAttemptedFillConfirm] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    const currentTemplate = getTemplateFile()
    setTemplateFileState(currentTemplate)
    setFileName(currentTemplate?.name || '')
    setSchema(getTemplateSchema())
    setFormValues(getReportDraft())
    setSavedTemplates(getSavedTemplates())
    setSavedDrafts(getSavedDrafts())
  }, [])

  const missingRequired = useMemo(
    () => schema.filter((field) => field.required && !formValues[field.key]),
    [schema, formValues],
  )

  const completionPercent = schema.length === 0 ? 0 : Math.round(((schema.length - missingRequired.length) / schema.length) * 100)
  const hasTemplate = Boolean(templateFile?.base64)
  const hasDetectedPlaceholders = schema.length > 0
  const canFill = hasTemplate && hasDetectedPlaceholders
  const canExport = canFill && missingRequired.length === 0

  const tabs = [
    { key: 'template', label: 'Template', number: 1, disabled: false },
    { key: 'fill', label: 'Fill', number: 2, disabled: !canFill },
    { key: 'export', label: 'Export', number: 3, disabled: !canFill },
  ]

  function resetFeedback() {
    setError('')
    setInfo('')
  }

  function applySchemaFromKeys(keys, sourceMode) {
    if (keys.length === 0) {
      if (sourceMode === 'saved') setSavedDetectedSchema([])
      if (sourceMode === 'upload') setUploadDetectedSchema([])
      setSchema([])
      setTemplateSchema([])
      setError('No placeholders found in this .docx file.')
      return
    }

    const generatedSchema = keys.map(inferFieldFromPlaceholder)
    if (sourceMode === 'saved') setSavedDetectedSchema(generatedSchema)
    if (sourceMode === 'upload') setUploadDetectedSchema(generatedSchema)
    setSchema(generatedSchema)
    setTemplateSchema(generatedSchema)

    const latestSaved = savedDrafts[0]?.values || savedDrafts[0]?.formValues || {}
    const storedDraft = getReportDraft()
    setFormValues((prev) => {
      const source = Object.keys(prev).length > 0 ? prev : { ...storedDraft, ...latestSaved }
      const hydrated = {}
      generatedSchema.forEach((field) => {
        hydrated[field.key] = source[field.key] ?? ''
      })
      return hydrated
    })
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    resetFeedback()
    setIsParsing(true)

    try {
      const keys = await extractPlaceholdersFromDocx(file)
      const payload = await setTemplateFile(file)
      setTemplateFileState(payload)
      setFileName(payload.name)
      applySchemaFromKeys(keys, 'upload')
      setInfo('Template loaded and placeholders detected.')
    } catch {
      setUploadDetectedSchema([])
      setSchema([])
      setTemplateSchema([])
      setError('Unable to parse this .docx file.')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleUseSavedTemplate(idOverride) {
    resetFeedback()

    const selectedId = idOverride ?? selectedSavedTemplateId
    const selected = savedTemplates.find((item) => item.id === selectedId)
    if (!selected) {
      setError('Select a saved template first.')
      return
    }

    setIsParsing(true)
    try {
      setTemplateFilePayload(selected)
      setTemplateFileState(selected)
      setFileName(selected.name)
      const arrayBuffer = decodeTemplateBase64(selected.base64)
      const keys = await extractPlaceholdersFromArrayBuffer(arrayBuffer)
      applySchemaFromKeys(keys, 'saved')
      setInfo('Saved template selected.')
    } catch {
      setSavedDetectedSchema([])
      setSchema([])
      setTemplateSchema([])
      setError('Unable to parse selected saved template.')
    } finally {
      setIsParsing(false)
    }
  }

  function handleSaveTemplate() {
    resetFeedback()

    if (!templateFile?.base64) {
      setError('Upload or select a template before saving.')
      return
    }

    saveTemplateToLibrary(templateFile)
    setSavedTemplates(getSavedTemplates())
    setInfo('Template saved.')
  }

  function updateField(nextSchema) {
    if (templateSourceMode === 'saved') {
      setSavedDetectedSchema(nextSchema)
    } else {
      setUploadDetectedSchema(nextSchema)
    }
    setSchema(nextSchema)
    setTemplateSchema(nextSchema)
  }

  function handleTypeChange(key, type) {
    updateField(schema.map((field) => (field.key === key ? { ...field, type } : field)))
  }

  function handleRequiredChange(key, required) {
    updateField(schema.map((field) => (field.key === key ? { ...field, required } : field)))
  }

  function handleRemoveField(key) {
    updateField(schema.filter((field) => field.key !== key))
  }

  function handleManualAdd() {
    resetFeedback()
    const key = manualKey.trim().replace(/\s+/g, '_')
    if (!key) return

    if (schema.some((field) => field.key === key)) {
      setError('Field already exists.')
      return
    }

    const field = inferFieldFromPlaceholder(key)
    field.type = manualType

    updateField([...schema, field].sort((a, b) => a.key.localeCompare(b.key)))
    setManualKey('')
    setManualType('text')
  }

  function handleValueChange(key, value) {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSaveCurrentDraft() {
    resetFeedback()

    if (schema.length === 0) {
      setError('Select a template and detect placeholders first.')
      return
    }

    const payload = {
      id: `draft-${Date.now()}`,
      name: draftName.trim() || `Draft ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      values: formValues,
    }

    saveDraftToLibrary(payload)
    setSavedDrafts(getSavedDrafts())
    setReportDraft(formValues)
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setInfo('Draft saved.')
  }

  function handleLoadDraft() {
    resetFeedback()
    const selected = savedDrafts.find((item) => item.id === selectedDraftId)

    if (!selected) {
      setError('Select a saved draft first.')
      return
    }

    const values = selected.values || selected.formValues || {}
    setFormValues(values)
    setReportDraft(values)

    setInfo('Draft loaded.')
    setActiveTab('fill')
  }

  function handleExportDocx() {
    resetFeedback()

    if (missingRequired.length > 0) {
      setError('Complete all required fields before export.')
      return
    }

    if (!templateFile?.base64) {
      setError('No template selected.')
      return
    }

    try {
      exportDocx(templateFile, formValues)
      setInfo('DOCX exported successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  function handleExportPdf() {
    resetFeedback()

    if (missingRequired.length > 0) {
      setError('Complete all required fields before export.')
      return
    }

    try {
      exportPdf(formValues)
      setInfo('PDF exported successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  function isCurrentTemplateSaved() {
    if (!templateFile?.base64) return false
    return savedTemplates.some((item) => item.base64 === templateFile.base64)
  }

  function handleNextFromTemplate() {
    resetFeedback()

    if (!canFill) return

    if (!isCurrentTemplateSaved()) {
      const shouldSave = window.confirm('Do you want to save this template before going to the next step?')
      if (shouldSave) {
        saveTemplateToLibrary(templateFile)
        setSavedTemplates(getSavedTemplates())
        setInfo('Template saved.')
      }
    }

    setActiveTab('fill')
  }

  function handleTemplateSourceChange(mode) {
    setTemplateSourceMode(mode)
    resetFeedback()

    if (mode === 'upload') {
      // User explicitly starts a new upload flow, so clear detected placeholders first.
      setUploadDetectedSchema([])
      setSchema([])
      setTemplateSchema([])
      return
    }

    if (mode === 'saved') {
      if (!selectedSavedTemplateId) {
        setSavedDetectedSchema([])
        setSchema([])
        setTemplateSchema([])
      } else if (savedDetectedSchema.length > 0) {
        setSchema(savedDetectedSchema)
        setTemplateSchema(savedDetectedSchema)
      }
    }
  }

  function handleSavedTemplateSelection(templateId) {
    setSelectedSavedTemplateId(templateId)
    if (!templateId) {
      setSavedDetectedSchema([])
      if (templateSourceMode === 'saved') {
        setSchema([])
        setTemplateSchema([])
      }
      return
    }
    handleUseSavedTemplate(templateId)
  }

  const templateTabSchema = useMemo(() => {
    if (templateSourceMode === 'saved') {
      return selectedSavedTemplateId ? savedDetectedSchema : []
    }
    return uploadDetectedSchema
  }, [templateSourceMode, selectedSavedTemplateId, savedDetectedSchema, uploadDetectedSchema])

  function handleConfirmAndGoExport() {
    resetFeedback()
    setAttemptedFillConfirm(true)
    if (missingRequired.length > 0) {
      setError('Some required values are missing. Fill them before going to Export.')
      return
    }
    setInfo('Values confirmed. Ready to export.')
    setActiveTab('export')
  }

  return (
    <main className="container">
      <section className="hero-card">
        <p className="eyebrow">MPT Report Generator</p>
        <h1>Smart Report Builder</h1>
        <p className="muted">Choose a template, detect placeholders, fill values, save drafts, and export.</p>
        <div className="flow-badges">
          <span className={`flow-badge ${hasTemplate ? 'done' : ''}`}>Template {hasTemplate ? 'Ready' : 'Pending'}</span>
          <span className={`flow-badge ${hasDetectedPlaceholders ? 'done' : ''}`}>
            Placeholders {hasDetectedPlaceholders ? 'Detected' : 'Pending'}
          </span>
          <span className={`flow-badge ${canExport ? 'done' : ''}`}>Export {canExport ? 'Ready' : 'Blocked'}</span>
        </div>
      </section>

      <section className="stepper">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`step-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            disabled={tab.disabled}
          >
            <span className="step-circle">{tab.number}</span>
            <span className="step-label">{tab.label}</span>
          </button>
        ))}
      </section>

      {error ? <p className="error">{error}</p> : null}
      {info ? <p className="info">{info}</p> : null}

      {activeTab === 'template' ? (
        <section className="card">
          <h2>Choose Template</h2>
          <p className="muted">Upload a new .docx or choose a previously saved template.</p>
          <div className="source-tabs">
            <button
              type="button"
              className={`tab-mini ${templateSourceMode === 'upload' ? 'active' : ''}`}
              onClick={() => handleTemplateSourceChange('upload')}
            >
              Load a template file
            </button>
            <button
              type="button"
              className={`tab-mini ${templateSourceMode === 'saved' ? 'active' : ''}`}
              onClick={() => handleTemplateSourceChange('saved')}
            >
              Select a saved template
            </button>
          </div>

          {templateSourceMode === 'upload' ? (
            <div className="upload-row">
              <input type="file" accept=".docx" onChange={handleFileUpload} />
              <button type="button" className="button ghost" onClick={handleSaveTemplate}>
                Save Template to Library
              </button>
            </div>
          ) : (
            <div className="upload-row">
              <select value={selectedSavedTemplateId} onChange={(event) => handleSavedTemplateSelection(event.target.value)}>
                <option value="">Select a saved template</option>
                {savedTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button type="button" className="button secondary" onClick={handleUseSavedTemplate}>
                Use Saved Template
              </button>
            </div>
          )}

          <p className="muted">Current template: {fileName || 'No template selected'}</p>
          {isParsing ? <p className="info">Detecting placeholders...</p> : null}

          <div className="section-header" style={{ marginTop: '1rem' }}>
            <h2>Detected Placeholders</h2>
            <span className="pill">{templateTabSchema.length} fields</span>
          </div>

          {templateTabSchema.length === 0 ? (
            <p className="muted">Select a template to detect placeholders.</p>
          ) : (
            <ul className="field-list">
              {templateTabSchema.map((field) => (
                <li key={field.key} className="field-item">
                  <div className="field-key">
                    <code>{`{{${field.key}}}`}</code>
                  </div>
                  <div className="field-controls">
                    <select value={field.type} onChange={(event) => handleTypeChange(field.key, event.target.value)}>
                      <option value="text">text</option>
                      <option value="date">date</option>
                      <option value="time">time</option>
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

          <div className="manual-add" style={{ marginTop: '0.8rem' }}>
            <input value={manualKey} placeholder="placeholder_key" onChange={(event) => setManualKey(event.target.value)} />
            <select value={manualType} onChange={(event) => setManualType(event.target.value)}>
              <option value="text">text</option>
              <option value="date">date</option>
              <option value="time">time</option>
            </select>
            <button type="button" className="button" onClick={handleManualAdd}>
              Add Field
            </button>
          </div>
          <div className="footer-actions">
            <button type="button" className="button" disabled={!canFill} onClick={handleNextFromTemplate}>
              Next: Enter Values
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'fill' ? (
        <section className="card">
          <div className="section-header">
            <h2>Enter Placeholder Values</h2>
            <span className="pill">{schema.length} fields</span>
          </div>

          <div className="source-tabs" style={{ marginBottom: '0.8rem' }}>
            <button
              type="button"
              className={`tab-mini ${fillMode === 'manual' ? 'active' : ''}`}
              onClick={() => setFillMode('manual')}
            >
              Fill manually all
            </button>
            <button
              type="button"
              className={`tab-mini ${fillMode === 'saved' ? 'active' : ''}`}
              onClick={() => setFillMode('saved')}
            >
              Load and update a saved draft
            </button>
          </div>

          {fillMode === 'saved' ? (
            <>
              <h2 style={{ marginBottom: '0.6rem' }}>Draft Library</h2>
              <div className="upload-row">
                <select value={selectedDraftId} onChange={(event) => setSelectedDraftId(event.target.value)}>
                  <option value="">Select a saved draft</option>
                  {savedDrafts.map((draft) => (
                    <option key={draft.id} value={draft.id}>
                      {draft.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="button ghost" onClick={handleLoadDraft}>
                  Load Draft
                </button>
              </div>
              {savedDrafts.length === 0 ? <p className="muted">No drafts saved yet.</p> : null}
            </>
          ) : null}

          {schema.length === 0 ? (
            <p className="muted">No placeholders detected yet. Start in the Template tab.</p>
          ) : (
            <form className="form-grid">
              {schema.map((field) => (
                <label className="field" key={field.key} htmlFor={field.key}>
                  <span>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  {renderField(field, formValues[field.key], handleValueChange)}
                </label>
              ))}
            </form>
          )}

          {attemptedFillConfirm && missingRequired.length > 0 ? (
            <div className="missing-under-buttons">
              <p className="error">Some required values are missing:</p>
              <ul className="mini-list">
                {missingRequired.map((field) => (
                  <li key={field.key}>{field.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="upload-row" style={{ marginTop: '1rem' }}>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Draft name (optional)"
            />
            <button type="button" className="button ghost" onClick={handleSaveCurrentDraft}>
              Save Draft to Library
            </button>
          </div>
          {savedAt ? <p className="info">Saved at {savedAt}</p> : null}
          <div className="footer-actions">
            <button type="button" className="button ghost" onClick={() => setActiveTab('template')}>
              Back: Template
            </button>
            <button type="button" className="button" onClick={handleConfirmAndGoExport}>
              Confirm Values & Next: Export
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'export' ? (
        <section className="card">
          <h2>Export Report</h2>
          <p className="muted">Completion: {completionPercent}%</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${completionPercent}%` }} />
          </div>
          <p className="muted">Template loaded: {templateFile?.name || 'No template selected'}</p>

          <div className="action-stack">
            <button type="button" className="button" onClick={handleExportDocx} disabled={!canExport}>
              Export DOCX
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={handleExportPdf}
              disabled={!canExport}
            >
              Export PDF
            </button>
          </div>

          <div className="missing-under-buttons">
            <p className="muted">Required fields not filled yet:</p>
            {missingRequired.length === 0 ? (
              <>
                <p className="info">All required fields complete.</p>
                <p className="muted">PDF export in this MVP is generated from form values.</p>
              </>
            ) : (
              <ul className="mini-list">
                {missingRequired.map((field) => (
                  <li key={field.key}>{field.label}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="footer-actions">
            <button type="button" className="button ghost" onClick={() => setActiveTab('fill')}>
              Back: Enter Values
            </button>
          </div>
        </section>
      ) : null}
    </main>
  )
}
