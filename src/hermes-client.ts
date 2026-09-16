import { emojiFromSeed, initialConversations, profiles as demoProfiles } from './data'
import { createId } from './id'
import { normalizeHistory } from './message-normalizer'
import type { Conversation, ConversationMessage, GatewayEvent, HermesClient, HermesProfile, InteractiveRequest, ProfileId } from './types'

type RpcResponse = { id?: number; result?: unknown; error?: { code?: number; message?: string }; method?: string; params?: Record<string, unknown>; type?: string }

const hash = (value: string) => [...value].reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)

export function normalizeTimestamp(value: unknown, fallback = Date.now()) {
  const safeFallback = Number.isFinite(fallback) ? fallback : Date.now()
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : safeFallback
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Math.abs(value) < 100_000_000_000) return value * 1000
    if (Math.abs(value) > 100_000_000_000_000) return value / 1000
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return normalizeTimestamp(numeric, safeFallback)
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return safeFallback
}

export function normalizeSessionSource(value: unknown): Conversation['source'] {
  if (value === 'cron') return 'cron'
  if (value === 'telegram') return 'telegram'
  if (value === 'tui' || value === 'cli') return 'tui'
  return 'web'
}

async function hermesFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: init?.credentials ?? 'include' })
  if (response.status === 401) {
    const payload = await response.clone().json().catch(() => ({})) as { login_url?: string }
    if (payload.login_url) {
      sessionStorage.setItem('hermes.lastLocation', location.pathname + location.search)
      location.assign(payload.login_url)
      return new Promise<Response>(() => undefined)
    }
  }
  return response
}

function normalizeProfile(raw: Record<string, unknown>, index: number): HermesProfile {
  const id = String(raw.name ?? raw.id ?? (index === 0 ? 'default' : `profile-${index}`))
  const palette = ['#6f6af8', '#ef805f', '#25a783', '#d45c92', '#4388d8']
  return {
    id,
    name: id === 'default' ? 'Hermes' : id.charAt(0).toUpperCase() + id.slice(1),
    description: String(raw.description ?? 'Hermes agent profile'),
    model: String(raw.model ?? raw.default_model ?? 'Hermes'),
    accent: palette[Math.abs(hash(id)) % palette.length],
    avatar: emojiFromSeed(Math.abs(hash(id))),
  }
}

export class DashboardHermesClient implements HermesClient {
  private ws?: WebSocket
  private nextId = 1
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: number }>()
  private listeners = new Set<(event: GatewayEvent) => void>()
  private connectPromise?: Promise<void>
  private liveSessionIds = new Map<string, string>()
  private storedSessionIds = new Map<string, string>()
  private reconnectAttempts = 0
  private reconnectTimer?: number

  constructor() {
    // A socket can go silently dead (laptop sleep, NAT/proxy idle timeout) without
    // ever firing close/error — readyState keeps reporting OPEN for a long time, so
    // a request made against it just vanishes. Re-verify the connection whenever the
    // tab wakes back up instead of trusting a stale readyState.
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.handleWake)
    if (typeof window !== 'undefined') window.addEventListener('online', this.handleWake)
  }

  private handleWake = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close()
    this.ensureConnected()
  }

  private ensureConnected() {
    this.connect().catch(() => this.scheduleReconnect())
  }

  dispose() {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.handleWake)
    if (typeof window !== 'undefined') window.removeEventListener('online', this.handleWake)
    if (this.reconnectTimer != null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer != null) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15_000)
    this.reconnectAttempts += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined
      this.ensureConnected()
    }, delay)
  }

  async listProfiles(): Promise<HermesProfile[]> {
    const response = await hermesFetch('/api/profiles')
    if (!response.ok) throw new Error(`Profiles unavailable (${response.status})`)
    const payload = await response.json() as unknown
    const list = Array.isArray(payload) ? payload : (payload as { profiles?: unknown[] }).profiles ?? []
    return list.map((item, index) => normalizeProfile(item as Record<string, unknown>, index))
  }

  async listConversations(profile?: ProfileId): Promise<Conversation[]> {
    const query = new URLSearchParams({ profile: profile ?? 'all', limit: '200', min_messages: '1', order: 'recent' })
    const response = await hermesFetch(`/api/profiles/sessions?${query}`)
    if (!response.ok) throw new Error(`Sessions unavailable (${response.status})`)
    const payload = await response.json() as unknown
    const rows = Array.isArray(payload) ? payload : (payload as { sessions?: unknown[] }).sessions ?? []
    return rows.map((value) => {
      const row = value as Record<string, unknown>
      return {
        id: String(row.id ?? row.session_id), profileId: String(row.profile ?? profile ?? 'default'), title: String(row.title ?? row.preview ?? 'Untitled conversation'),
        preview: String(row.preview ?? ''), updatedAt: normalizeTimestamp(row.last_active ?? row.updated_at ?? row.ended_at ?? row.started_at), source: normalizeSessionSource(row.source),
        model: String(row.model ?? 'Hermes'), unread: false, runState: 'idle', messages: [],
      } satisfies Conversation
    })
  }

  async getHistory(profile: string, conversationId: string): Promise<ConversationMessage[]> {
    const response = await hermesFetch(`/api/sessions/${encodeURIComponent(conversationId)}/messages?limit=500&order=oldest&profile=${encodeURIComponent(profile)}`)
    if (!response.ok) throw new Error(`History unavailable (${response.status})`)
    const payload = await response.json() as unknown
    const envelope = payload as { messages?: unknown[]; data?: unknown[] }
    const rows = Array.isArray(payload) ? payload : envelope.messages ?? envelope.data ?? []
    return normalizeHistory(rows, conversationId)
  }

  async createConversation(profile: string) {
    const result = await this.request('session.create', { profile }) as Record<string, unknown>
    const id = String(result.session_id ?? result.id ?? createId())
    return { id, profileId: profile, title: 'New conversation', preview: '', updatedAt: Date.now(), source: 'web', model: '', unread: false, runState: 'idle', messages: [] } satisfies Conversation
  }

  submit(profile: string, conversationId: string, text: string) {
    return this.withSessionResume(profile, conversationId, (sessionId) => this.request('prompt.submit', { profile, session_id: sessionId, text })).then(() => undefined)
  }
  interrupt(profile: string, conversationId: string) {
    return this.withSessionResume(profile, conversationId, (sessionId) => this.request('session.interrupt', { profile, session_id: sessionId })).then(() => undefined)
  }
  steer(profile: string, conversationId: string, text: string) {
    return this.withSessionResume(profile, conversationId, (sessionId) => this.request('session.steer', { profile, session_id: sessionId, text })).then(() => undefined)
  }
  respond(profile: string, conversationId: string, request: InteractiveRequest, value: string) {
    return this.withSessionResume(profile, conversationId, (sessionId) => {
      const params = { profile, session_id: sessionId }
      if (request.kind === 'approval') return this.request('approval.respond', { ...params, choice: value })
      const responseKey = request.kind === 'clarify' ? 'answer' : request.kind === 'sudo' ? 'password' : 'value'
      return this.request(`${request.kind}.respond`, { ...params, request_id: request.id, [responseKey]: value })
    }).then(() => undefined)
  }
  attachFile(profile: string, conversationId: string, file: { name: string; dataUrl: string }) {
    return this.withSessionResume(profile, conversationId, (sessionId) => this.request('file.attach', { profile, session_id: sessionId, data_url: file.dataUrl, name: file.name })).then((result) => {
      const payload = result as Record<string, unknown>
      return { name: String(payload.name ?? file.name), refText: String(payload.ref_text ?? `@file:${file.name}`) }
    })
  }

  // A conversation picked from history has no live gateway runtime — the process
  // that ran it may have been reaped long ago. The gateway rejects any session-scoped
  // RPC against it with "session not found." Resume re-registers the durable session
  // and mints a fresh runtime id; we retry the call once against that id and remember
  // the mapping so later calls (and incoming events, remapped in `receive`) land on it too.
  private async withSessionResume<T>(profile: string, storedSessionId: string, call: (sessionId: string) => Promise<T>): Promise<T> {
    const sessionId = this.liveSessionIds.get(storedSessionId) ?? storedSessionId
    try {
      return await call(sessionId)
    } catch (error) {
      if (!/session not found/i.test(error instanceof Error ? error.message : String(error))) throw error
      const resumed = await this.request('session.resume', { profile, session_id: storedSessionId, source: 'web', omit_messages: true }) as Record<string, unknown>
      const liveId = String(resumed.session_id ?? '')
      if (!liveId) throw error
      this.liveSessionIds.set(storedSessionId, liveId)
      this.storedSessionIds.set(liveId, storedSessionId)
      return call(liveId)
    }
  }
  subscribe(listener: (event: GatewayEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  private async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    if (this.connectPromise) return this.connectPromise
    this.connectPromise = (async () => {
      const ticketResponse = await hermesFetch('/api/auth/ws-ticket', { method: 'POST' })
      const ticketPayload = ticketResponse.ok ? await ticketResponse.json() as Record<string, unknown> : {}
      const ticket = String(ticketPayload.ticket ?? '')
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const path = ticket ? `/api/ws?ticket=${encodeURIComponent(ticket)}` : '/api/ws'
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${protocol}//${location.host}${path}`)
        this.ws = ws
        // Forcing a fresh connection (handleWake) leaves the old socket's close/error
        // still pending. Ignore events from any socket that isn't the current one so a
        // superseded socket can't clobber connectPromise or reject the new socket's requests.
        ws.onopen = () => {
          if (this.ws !== ws) return
          this.reconnectAttempts = 0
          resolve()
        }
        ws.onerror = () => {
          if (this.ws !== ws) return
          reject(new Error('Unable to connect to Hermes Gateway'))
        }
        ws.onclose = () => {
          if (this.ws !== ws) return
          this.connectPromise = undefined
          this.rejectPending(new Error('Hermes connection closed'))
          this.scheduleReconnect()
        }
        ws.onmessage = (event) => {
          if (this.ws !== ws) return
          this.receive(JSON.parse(String(event.data)) as RpcResponse)
        }
      })
    })()
    try { await this.connectPromise } finally { this.connectPromise = undefined }
  }

  private async request(method: string, params: Record<string, unknown>) {
    await this.connect()
    const id = this.nextId++
    return new Promise<unknown>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        this.ws?.close()
        reject(new Error(`${method} timed out`))
      }, 30_000)
      this.pending.set(id, { resolve, reject, timer })
      this.ws!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  private receive(message: RpcResponse) {
    if (message.id != null) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message ?? 'Hermes request failed'))
      else pending.resolve(message.result)
      return
    }
    this.remapLiveSessionIds(message)
    this.listeners.forEach((listener) => listener(message as GatewayEvent))
  }

  // Gateway events carry whichever session id the RPC actually landed on — the
  // resumed runtime id after a recovery, not the durable id the UI keys conversations
  // by. Rewrite it back so App.tsx never needs to know a resume happened.
  private remapLiveSessionIds(value: unknown, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 4) return
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'session_id' || key === 'sessionId') && typeof child === 'string' && this.storedSessionIds.has(child)) {
        (value as Record<string, unknown>)[key] = this.storedSessionIds.get(child)!
      } else if (child && typeof child === 'object') {
        this.remapLiveSessionIds(child, depth + 1)
      }
    }
  }

  private rejectPending(error: Error) {
    this.pending.forEach(({ reject, timer }) => { clearTimeout(timer); reject(error) })
    this.pending.clear()
  }
}

export class DemoHermesClient implements HermesClient {
  private conversations = structuredClone(initialConversations)
  private listeners = new Set<(event: GatewayEvent) => void>()
  async listProfiles() { return structuredClone(demoProfiles) }
  async listConversations() { return structuredClone(this.conversations) }
  async getHistory(_profile: string, conversationId: string) { return structuredClone(this.conversations.find((item) => item.id === conversationId)?.messages ?? []) }
  async createConversation(profile: string) {
    const profileData = demoProfiles.find((item) => item.id === profile) ?? demoProfiles[0]
    const conversation: Conversation = { id: createId(), profileId: profile, title: 'New conversation', preview: 'Start something new', updatedAt: Date.now(), source: 'web', model: profileData.model, unread: false, runState: 'idle', messages: [] }
    this.conversations.unshift(conversation)
    return structuredClone(conversation)
  }
  async submit(profile: string, conversationId: string, text: string) {
    const pieces = ['I’m on it. ', 'I’ll keep this focused and practical.\n\n', `For **${text.slice(0, 42)}${text.length > 42 ? '…' : ''}**, the strongest next step is to clarify the outcome, gather only the necessary context, and then work in small verifiable increments.`, '\n\nI can continue with the implementation or dig into any part of this in more detail.']
    this.emit({ method: 'session.status', params: { session_id: conversationId, profile, running: true } })
    for (const piece of pieces) {
      await new Promise((resolve) => setTimeout(resolve, 380))
      this.emit({ method: 'message.delta', params: { session_id: conversationId, profile, delta: piece } })
    }
    this.emit({ method: 'message.complete', params: { session_id: conversationId, profile } })
  }
  async interrupt(profile: string, conversationId: string) { this.emit({ method: 'session.status', params: { session_id: conversationId, profile, running: false } }) }
  async steer(profile: string, conversationId: string, text: string) { return this.submit(profile, conversationId, text) }
  async respond(profile: string, _conversationId: string, request: InteractiveRequest, value: string) { this.emit({ method: 'interactive.complete', params: { profile, request_id: request.id, value } }) }
  async attachFile(_profile: string, _conversationId: string, file: { name: string; dataUrl: string }) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return { name: file.name, refText: `@file:${file.name}` }
  }
  subscribe(listener: (event: GatewayEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private emit(event: GatewayEvent) { this.listeners.forEach((listener) => listener(event)) }
}

export async function createHermesClient(): Promise<{ client: HermesClient; demo: boolean }> {
  const real = new DashboardHermesClient()
  try {
    const response = await fetch('/api/status', { signal: AbortSignal.timeout(1200) })
    if (!response.ok) throw new Error('No dashboard')
    return { client: real, demo: false }
  } catch {
    return { client: new DemoHermesClient(), demo: true }
  }
}
