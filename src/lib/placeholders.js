import JSZip from 'jszip'

const XML_PART_PATTERN = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g
const SINGLE_PLACEHOLDER_PATTERN = /(?<!\{)\{\s*([a-zA-Z0-9_.-]+)\s*\}(?!\})/g

function decodeXmlEntities(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function extractVisibleWordText(xmlContent) {
  const textNodePattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
  let visibleText = ''
  let match = textNodePattern.exec(xmlContent)

  while (match) {
    visibleText += decodeXmlEntities(match[1])
    match = textNodePattern.exec(xmlContent)
  }

  return visibleText
}

function collectPlaceholdersFromText(text, destinationSet) {
  let match = PLACEHOLDER_PATTERN.exec(text)
  while (match) {
    destinationSet.add(match[1])
    match = PLACEHOLDER_PATTERN.exec(text)
  }
  PLACEHOLDER_PATTERN.lastIndex = 0

  let singleMatch = SINGLE_PLACEHOLDER_PATTERN.exec(text)
  while (singleMatch) {
    destinationSet.add(singleMatch[1])
    singleMatch = SINGLE_PLACEHOLDER_PATTERN.exec(text)
  }
  SINGLE_PLACEHOLDER_PATTERN.lastIndex = 0
}

function prettyLabel(key) {
  return key
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function inferFieldFromPlaceholder(key) {
  const normalized = key.toLowerCase()

  if (normalized.includes('date')) {
    return { key, label: prettyLabel(key), type: 'date', required: true }
  }

  if (normalized.includes('time')) {
    return { key, label: prettyLabel(key), type: 'time', required: true }
  }

  return { key, label: prettyLabel(key), type: 'text', required: true }
}

async function extractPlaceholders(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const xmlParts = Object.keys(zip.files).filter((name) => XML_PART_PATTERN.test(name))
  const unique = new Set()

  for (const partName of xmlParts) {
    const content = await zip.file(partName)?.async('text')
    if (!content) continue

    // Try raw XML first, then visible text extracted from w:t nodes for split-run placeholders.
    collectPlaceholdersFromText(content, unique)
    collectPlaceholdersFromText(extractVisibleWordText(content), unique)
  }

  return Array.from(unique).sort()
}

export async function extractPlaceholdersFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  return extractPlaceholders(arrayBuffer)
}

export async function extractPlaceholdersFromArrayBuffer(arrayBuffer) {
  return extractPlaceholders(arrayBuffer)
}
