import type { ToolExecution } from './types'

export type ToolField = { label: string; value: string; kind?: 'code' | 'command' | 'output' | 'text' }
export type ToolPresentation = { emoji: string; title: string; summary?: string; fields: ToolField[] }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value
  try { return JSON.parse(trimmed) as unknown } catch { return value }
}

function pick(record: unknown, keys: string[]): unknown {
  if (!isRecord(record)) return undefined
  for (const key of keys) if (record[key] != null && record[key] !== '') return record[key]
}

function readable(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') {
    const parsed = parse(value)
    return parsed === value ? value : readable(parsed)
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join('\n')
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([, item]) => item != null && item !== '')
      .map(([key, item]) => `${humanize(key)}: ${readable(item)}`)
      .join('\n')
  }
  return ''
}

function nested(record: unknown, ...keys: string[]): unknown {
  let value = record
  for (const key of keys) {
    value = pick(parse(value), [key])
    if (value == null) return undefined
  }
  return parse(value)
}

function asArray(value: unknown): unknown[] {
  const parsed = parse(value)
  return Array.isArray(parsed) ? parsed : []
}

function webItems(output: unknown): unknown[] {
  const candidates = [
    nested(output, 'data', 'web'), nested(output, 'data', 'results'), nested(output, 'data', 'items'),
    pick(output, ['web', 'results', 'items']),
  ]
  for (const candidate of candidates) {
    const items = asArray(candidate)
    if (items.length) return items
  }
  return []
}

function pageName(url: unknown) {
  const value = readable(url).trim()
  if (!value) return 'Page'
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return value }
}

function resultFields(items: unknown[], contentKeys: string[]): ToolField[] {
  return items.flatMap((item, index) => {
    const url = pick(item, ['url', 'href', 'link', 'uri'])
    const title = pick(item, ['title', 'name'])
    const error = pick(item, ['error', 'message'])
    const content = pick(item, contentKeys)
    const label = `${index + 1}. ${short(title, pageName(url))}`
    return fields(field(label, [url, error ? `Error: ${readable(error)}` : content].filter(Boolean)))
  })
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function short(value: unknown, fallback = '') {
  const text = readable(value).replace(/\s+/g, ' ').trim()
  return text.length > 90 ? `${text.slice(0, 87)}…` : text || fallback
}

function field(label: string, value: unknown, kind: ToolField['kind'] = 'text'): ToolField | undefined {
  const text = readable(value).trim()
  return text ? { label, value: text, kind } : undefined
}

function fields(...values: Array<ToolField | undefined>) {
  return values.filter((value): value is ToolField => Boolean(value))
}

export function presentTool(tool: ToolExecution): ToolPresentation {
  const name = tool.name.toLowerCase()
  const input = parse(tool.input)
  const output = parse(tool.output)

  if (/terminal|bash|shell|command|execute/.test(name)) {
    const command = pick(input, ['command', 'cmd', 'script']) ?? input
    const result = pick(output, ['output', 'stdout', 'result', 'text']) ?? (isRecord(output) ? undefined : output)
    const error = pick(output, ['stderr', 'error', 'message'])
    const exitCode = pick(output, ['exit_code', 'exitCode', 'code', 'status'])
    return {
      emoji: '⚡', title: 'Ran a command', summary: short(command, tool.label),
      fields: fields(field('Command', command, 'command'), field('Output', result, 'output'), field('Error output', error, 'output'), field('Exit status', exitCode)),
    }
  }

  if (/read|file_get|open_file/.test(name) && !/web|url|browser/.test(name)) {
    const path = pick(input, ['path', 'file_path', 'file', 'filename']) ?? input
    const content = pick(output, ['content', 'text', 'output', 'result']) ?? (isRecord(output) ? undefined : output)
    return { emoji: '📄', title: 'Read a file', summary: short(path, tool.label), fields: fields(field('File', path, 'code'), field('Contents', content, 'output')) }
  }

  if (/search|grep|find/.test(name) && !/web/.test(name)) {
    const query = pick(input, ['query', 'pattern', 'search', 'text']) ?? input
    const location = pick(input, ['path', 'directory', 'glob'])
    const results = pick(output, ['matches', 'results', 'output', 'text']) ?? output
    return { emoji: '🔎', title: 'Searched the workspace', summary: short(query, tool.label), fields: fields(field('Search', query, 'code'), field('Location', location, 'code'), field('Matches', results, 'output')) }
  }

  if (/web_search/.test(name)) {
    const query = pick(input, ['query', 'q', 'search']) ?? input
    const items = webItems(output)
    const result = pick(output, ['output', 'text', 'content']) ?? output
    return {
      emoji: '🌐', title: 'Searched the web', summary: short(query, tool.label),
      fields: fields(field('Search', query), ...(items.length ? resultFields(items, ['description', 'snippet', 'text', 'content']) : fields(field('Results', result, 'output')))),
    }
  }

  if (/web|url|fetch|browser|navigate|extract/.test(name)) {
    const url = pick(input, ['url', 'urls', 'href', 'uri'])
    const action = pick(input, ['action', 'operation'])
    const pages = webItems(output)
    const result = pick(output, ['title', 'text', 'content', 'result', 'output']) ?? output
    return {
      emoji: /browser|navigate/.test(name) ? '🧭' : '🌐',
      title: /browser|navigate/.test(name) ? 'Used the browser' : 'Read a web page',
      summary: short(url ?? action ?? input, tool.label),
      fields: pages.length ? resultFields(pages, ['content', 'text', 'description', 'snippet']) : fields(field('Page', url), field('Action', action), field('Result', result, 'output')),
    }
  }

  if (/write|create_file|save/.test(name)) {
    const path = pick(input, ['path', 'file_path', 'file', 'filename'])
    const content = pick(input, ['content', 'text'])
    const result = pick(output, ['message', 'result', 'output']) ?? output
    return { emoji: '✏️', title: 'Wrote a file', summary: short(path, tool.label), fields: fields(field('File', path, 'code'), field('Content', content, 'output'), field('Result', result)) }
  }

  if (/edit|patch|replace/.test(name)) {
    const path = pick(input, ['path', 'file_path', 'file', 'filename'])
    const change = pick(input, ['patch', 'diff', 'new_string', 'replacement', 'content'])
    const result = pick(output, ['message', 'result', 'output']) ?? output
    return { emoji: '✏️', title: 'Edited a file', summary: short(path, tool.label), fields: fields(field('File', path, 'code'), field('Change', change, 'output'), field('Result', result)) }
  }

  if (/image/.test(name)) {
    const prompt = pick(input, ['prompt', 'description']) ?? input
    const result = pick(output, ['image_url', 'url', 'path', 'result']) ?? output
    return { emoji: '🖼️', title: 'Created an image', summary: short(prompt, tool.label), fields: fields(field('Prompt', prompt), field('Image', result)) }
  }

  return {
    emoji: '🧰', title: humanize(tool.label || tool.name), summary: short(input, tool.label),
    fields: fields(field('Details', input), field('Result', output, 'output')),
  }
}
