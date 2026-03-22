const STORAGE_KEYS = {
  templateSchema: 'mpt.templateSchema',
  reportDraft: 'mpt.reportDraft',
  templateFile: 'mpt.templateFile',
  savedTemplates: 'mpt.savedTemplates',
  savedDrafts: 'mpt.savedDrafts',
}

function safeParse(value, fallback) {
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function getTemplateSchema() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.templateSchema), [])
}

export function setTemplateSchema(schema) {
  localStorage.setItem(STORAGE_KEYS.templateSchema, JSON.stringify(schema))
}

export function getReportDraft() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.reportDraft), {})
}

export function setReportDraft(values) {
  localStorage.setItem(STORAGE_KEYS.reportDraft, JSON.stringify(values))
}

export function clearDemoStorage() {
  localStorage.removeItem(STORAGE_KEYS.templateSchema)
  localStorage.removeItem(STORAGE_KEYS.reportDraft)
  localStorage.removeItem(STORAGE_KEYS.templateFile)
  localStorage.removeItem(STORAGE_KEYS.savedTemplates)
  localStorage.removeItem(STORAGE_KEYS.savedDrafts)
}

function toBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function fromBase64(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function setTemplateFile(file) {
  const buffer = await file.arrayBuffer()
  const payload = {
    id: `tpl-${Date.now()}`,
    name: file.name,
    base64: toBase64(buffer),
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEYS.templateFile, JSON.stringify(payload))
  return payload
}

export function setTemplateFilePayload(payload) {
  localStorage.setItem(STORAGE_KEYS.templateFile, JSON.stringify(payload))
}

export function getTemplateFile() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.templateFile), null)
}

export function clearTemplateFile() {
  localStorage.removeItem(STORAGE_KEYS.templateFile)
}

export function getSavedTemplates() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.savedTemplates), [])
}

export function saveTemplateToLibrary(templatePayload) {
  const existing = getSavedTemplates()
  const nameExists = existing.some((item) => item.name === templatePayload.name)
  const safeName = nameExists ? `${templatePayload.name} (${new Date().toLocaleTimeString()})` : templatePayload.name
  const savedTemplate = {
    ...templatePayload,
    id: `tpl-lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: safeName,
    createdAt: new Date().toISOString(),
  }
  const next = [savedTemplate, ...existing]
  localStorage.setItem(STORAGE_KEYS.savedTemplates, JSON.stringify(next))
  return savedTemplate
}

export function decodeTemplateBase64(base64) {
  return fromBase64(base64)
}

export function getSavedDrafts() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.savedDrafts), [])
}

export function saveDraftToLibrary(draftPayload) {
  const existing = getSavedDrafts()
  const next = [draftPayload, ...existing]
  localStorage.setItem(STORAGE_KEYS.savedDrafts, JSON.stringify(next))
  return draftPayload
}
