import type { ConversationMessage, InteractiveRequest, MessageBlock, ToolExecution } from './types'

type RawMessage = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function parsedStructuredText(value: string): unknown {
  const trimmed = value.trim()
  if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return undefined
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed.some((item) => isRecord(item) && ('text' in item || 'content' in item || 'output_text' in item)) ? parsed : undefined
    if (isRecord(parsed) && ('text' in parsed || 'content' in parsed || 'output_text' in parsed || 'message' in parsed)) return parsed
  } catch {
    // Ordinary prose can begin with JSON punctuation. Leave it untouched.
  }
  return undefined
}

/** Extract display text without ever stringifying transport objects into chat. */
export function displayText(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    const parsed = parsedStructuredText(value)
    return parsed === undefined ? value : displayText(parsed, depth + 1)
  }
  if (value == null || depth > 4) return ''
  if (Array.isArray(value)) return value.map((item) => displayText(item, depth + 1)).join('')
  if (!isRecord(value)) return ''

  const candidate = value.text ?? value.output_text ?? value.content ?? value.message
  return candidate === value ? '' : displayText(candidate, depth + 1)
}

function toolDetail(value: unknown): unknown {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value
  try { return JSON.parse(trimmed) as unknown } catch { return value }
}

function rawToolCalls(value: unknown): RawMessage[] {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) as unknown } catch { return [] }
  }
  return Array.isArray(parsed) ? parsed.filter(isRecord) : []
}

function toolFromCall(call: RawMessage, index: number): ToolExecution {
  const fn = isRecord(call.function) ? call.function : call
  const name = String(fn.name ?? call.name ?? 'tool')
  return {
    id: String(call.id ?? call.tool_call_id ?? `tool-${index}`),
    name,
    label: name.replaceAll('_', ' '),
    input: toolDetail(fn.arguments ?? call.args ?? call.input),
    status: 'running',
  }
}

export function normalizeHistoryMessage(raw: RawMessage, conversationId: string, index: number): ConversationMessage | null {
  if (raw.display_kind === 'hidden') return null

  const rawRole = String(raw.role ?? 'assistant')
  const createdAtValue = raw.created_at ?? raw.timestamp ?? Date.now()
  const createdAt = typeof createdAtValue === 'number'
    ? (createdAtValue < 10_000_000_000 ? createdAtValue * 1000 : createdAtValue)
    : new Date(String(createdAtValue)).getTime()
  const id = String(raw.id ?? raw.row_id ?? `${conversationId}-${index}`)

  if (rawRole === 'tool') {
    const name = String(raw.tool_name ?? raw.name ?? 'tool')
    return {
      id,
      role: 'assistant',
      createdAt,
      blocks: [{ type: 'tool', tool: {
        id: String(raw.tool_call_id ?? id),
        name,
        label: name.replaceAll('_', ' '),
        input: toolDetail(raw.args ?? raw.context),
        output: toolDetail(raw.content ?? raw.text),
        status: 'complete',
      } }],
    }
  }

  const role = rawRole === 'user' ? 'user' : rawRole === 'system' ? 'system' : 'assistant'
  const blocks: MessageBlock[] = []
  const text = displayText(raw.content ?? raw.text)
  if (text.trim()) blocks.push({ type: 'markdown', text })
  if (role === 'assistant') rawToolCalls(raw.tool_calls).forEach((call, toolIndex) => blocks.push({ type: 'tool', tool: toolFromCall(call, toolIndex) }))
  if (blocks.length === 0) return null

  return { id, role, createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(), blocks }
}

function mergeAssistantBlocks(existing: MessageBlock[], incoming: MessageBlock[]) {
  const blocks = [...existing]
  for (const block of incoming) {
    if (block.type !== 'tool') {
      blocks.push(block)
      continue
    }

    const match = blocks.findIndex((candidate) => candidate.type === 'tool' && candidate.tool.id === block.tool.id)
    if (match < 0) {
      blocks.push(block)
      continue
    }

    const current = blocks[match]
    if (current.type === 'tool') blocks[match] = { type: 'tool', tool: {
      ...current.tool,
      ...block.tool,
      input: block.tool.input ?? current.tool.input,
      output: block.tool.output ?? current.tool.output,
    } }
  }
  return blocks
}

/** Keep one assistant turn—including all of its tool work—in one visual reply. */
export function normalizeHistory(rows: unknown[], conversationId: string): ConversationMessage[] {
  const messages: ConversationMessage[] = []
  rows.forEach((value, index) => {
    const next = normalizeHistoryMessage(value as RawMessage, conversationId, index)
    if (!next) return
    const previous = messages.at(-1)
    if (next.role === 'assistant' && previous?.role === 'assistant') {
      messages[messages.length - 1] = {
        ...previous,
        blocks: mergeAssistantBlocks(previous.blocks, next.blocks),
      }
    } else {
      messages.push(next)
    }
  })
  return messages
}

export function gatewayEventData(event: Record<string, unknown>) {
  const params = isRecord(event.params) ? event.params : undefined
  const payload = isRecord(event.payload) ? event.payload : undefined
  const eventType = params && typeof params.type === 'string' ? params.type : undefined
  const eventPayload = params && isRecord(params.payload) ? params.payload : undefined
  const data = eventPayload ?? payload ?? params ?? event
  return {
    method: String(eventType ?? event.method ?? event.type ?? ''),
    data,
    sessionId: String(data.session_id ?? data.sessionId ?? params?.session_id ?? params?.sessionId ?? event.session_id ?? event.sessionId ?? ''),
  }
}

export function interactiveRequestFromGateway(method: string, data: Record<string, unknown>): InteractiveRequest | undefined {
  const kind = method.replace(/\.request$/, '')
  if (kind !== 'approval' && kind !== 'clarify' && kind !== 'sudo' && kind !== 'secret') return undefined

  const choices = Array.isArray(data.choices) ? data.choices.filter((choice): choice is string => typeof choice === 'string') : undefined
  const text = (...values: unknown[]) => values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
  const description = kind === 'approval'
    ? text(data.message, data.prompt, data.command) ?? 'Hermes needs your approval to continue.'
    : kind === 'clarify'
      ? text(data.question, data.prompt) ?? 'Hermes needs more information to continue.'
      : kind === 'secret'
        ? text(data.prompt, data.message) ?? `Enter ${text(data.env_var) ?? 'the requested secret'}.`
        : text(data.prompt, data.message) ?? 'Enter your administrator password to continue.'

  return {
    id: String(data.request_id ?? data.id ?? `${kind}-request`),
    kind,
    title: kind === 'approval' ? 'Approval required' : kind === 'clarify' ? 'Question' : kind === 'secret' ? 'Secret required' : 'Administrator password required',
    description,
    options: choices,
  }
}
