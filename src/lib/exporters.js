import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import jsPDF from 'jspdf'
import { saveAs } from 'file-saver'

const XML_PART_PATTERN = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/

function fromBase64(base64) {
  return atob(base64)
}

function formatDateStamp() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDocxFilename(formValues) {
  const projectId = formValues.project_id || formValues.projectId || 'demo'
  return `report-${projectId}-${formatDateStamp()}.docx`
}

function getPdfFilename(formValues) {
  const projectId = formValues.project_id || formValues.projectId || 'demo'
  return `report-${projectId}-${formatDateStamp()}.pdf`
}

function buildRenderData(formValues) {
  const data = { ...formValues }

  for (const [key, value] of Object.entries(data)) {
    if (value == null) {
      data[key] = ''
      continue
    }
    if (Array.isArray(value)) {
      data[key] = value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('\n')
      continue
    }
    if (typeof value === 'object') {
      data[key] = JSON.stringify(value)
      continue
    }
    data[key] = String(value)
  }

  return data
}

function writeWrappedText(doc, text, x, y, maxWidth, lineHeight = 7) {
  const lines = doc.splitTextToSize(String(text ?? ''), maxWidth)
  lines.forEach((line) => {
    doc.text(line, x, y)
    y += lineHeight
  })
  return y
}

function prettyLabel(key) {
  return key
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeXmlEntities(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function readDocxError(error) {
  if (!error) return null
  if (error.properties?.errors?.length) {
    return error.properties.errors
      .map((item) => item.properties?.explanation || item.message)
      .filter(Boolean)
      .join('; ')
  }
  if (error.message) return error.message
  return null
}

function replaceInXmlContent(content, formValues) {
  let result = content

  for (const [key, rawValue] of Object.entries(formValues)) {
    const normalizedValue =
      rawValue == null
        ? ''
        : Array.isArray(rawValue)
          ? rawValue
              .map((item) =>
                typeof item === 'object'
                  ? `${item.index || ''} ${item.name || ''} ${item.result || ''}`.trim()
                  : String(item),
              )
              .join('\n')
          : typeof rawValue === 'object'
            ? ''
            : rawValue
    const value = escapeXml(normalizedValue)
    const doublePattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    const singlePattern = new RegExp(`\\{\\s*${key}\\s*\\}`, 'g')
    result = result.replace(doublePattern, value).replace(singlePattern, value)
  }

  return result
}

function extractParagraphLinesFromDocumentXml(xmlContent) {
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g
  const textNodePattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
  const lines = []
  let paragraphMatch = paragraphPattern.exec(xmlContent)

  while (paragraphMatch) {
    const paragraphXml = paragraphMatch[0]
    let line = ''
    let textMatch = textNodePattern.exec(paragraphXml)
    while (textMatch) {
      line += decodeXmlEntities(textMatch[1])
      textMatch = textNodePattern.exec(paragraphXml)
    }
    lines.push(line.trim())
    paragraphMatch = paragraphPattern.exec(xmlContent)
  }

  return lines
}

function exportDocxByXmlReplacement(templateFile, formValues) {
  const zip = new PizZip(fromBase64(templateFile.base64))
  const xmlParts = Object.keys(zip.files).filter((name) => XML_PART_PATTERN.test(name))

  for (const partName of xmlParts) {
    const file = zip.file(partName)
    if (!file) continue
    const content = file.asText()
    zip.file(partName, replaceInXmlContent(content, formValues))
  }

  const blob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  saveAs(blob, getDocxFilename(formValues))
}

export function exportDocx(templateFile, formValues) {
  if (!templateFile?.base64) {
    throw new Error('No uploaded template found. Upload a .docx template first.')
  }

  const renderData = buildRenderData(formValues)

  try {
    const zip = new PizZip(fromBase64(templateFile.base64))

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{{',
        end: '}}',
      },
      // Prevent unresolved fields from rendering as "undefined".
      nullGetter: () => '',
    })

    doc.render(renderData)

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    saveAs(blob, getDocxFilename(formValues))
  } catch (error) {
    try {
      exportDocxByXmlReplacement(templateFile, renderData)
    } catch {
      const details = readDocxError(error)
      throw new Error(
        `DOCX export failed. Ensure placeholders are valid and match your form fields.${details ? ` Details: ${details}` : ''}`,
      )
    }
  }
}

export function exportPdf(templateFile, formValues, schema = []) {
  const renderData = buildRenderData(formValues)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = doc.internal.pageSize.getWidth()
  const maxWidth = pageWidth - margin * 2
  let y = margin

  doc.setFontSize(16)
  doc.text('Report Export', margin, y)
  y += 10

  doc.setFontSize(11)
  let lines = []

  if (templateFile?.base64) {
    try {
      const zip = new PizZip(fromBase64(templateFile.base64))
      const docx = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '{{',
          end: '}}',
        },
        nullGetter: () => '',
      })

      docx.render(renderData)
      const renderedZip = docx.getZip()
      const renderedXml = renderedZip.file('word/document.xml')?.asText() || ''
      if (renderedXml) {
        lines = extractParagraphLinesFromDocumentXml(renderedXml)
      }
    } catch {
      // Fallback to lightweight replacement when docx templating fails.
      const zip = new PizZip(fromBase64(templateFile.base64))
      const documentXmlFile = zip.file('word/document.xml')
      const documentXml = documentXmlFile?.asText() || ''
      if (documentXml) {
        const filledXml = replaceInXmlContent(documentXml, renderData)
        lines = extractParagraphLinesFromDocumentXml(filledXml)
      }
    }
  }

  if (lines.length === 0) {
    const orderedEntries = []
    const usedKeys = new Set()

    if (Array.isArray(schema) && schema.length > 0) {
      schema.forEach((field) => {
        usedKeys.add(field.key)
        orderedEntries.push({
          key: field.key,
          label: field.label || prettyLabel(field.key),
          value: renderData[field.key] ?? '',
        })
      })
    }

    Object.entries(renderData).forEach(([key, value]) => {
      if (usedKeys.has(key)) return
      orderedEntries.push({ key, label: prettyLabel(key), value })
    })

    lines = orderedEntries.map(({ label, value }) => `${label}: ${value}`)
  }

  if (lines.length === 0) {
    y = writeWrappedText(doc, 'No values entered.', margin, y, maxWidth)
  } else {
    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage()
        y = margin
      }
      y = writeWrappedText(doc, line, margin, y, maxWidth)
    })
  }

  doc.save(getPdfFilename(formValues))
}
