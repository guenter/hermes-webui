// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardHermesClient, DemoHermesClient, normalizeSessionSource, normalizeTimestamp } from './hermes-client'

class FakeSocket {
  static instances: FakeSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readyState = FakeSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  sent: string[] = []
  constructor(public url: string) { FakeSocket.instances.push(this) }
  send(data: string) { this.sent.push(data) }
  open() { this.readyState = FakeSocket.OPEN; this.onopen?.() }
  close() { this.readyState = FakeSocket.CLOSED; this.onclose?.() }
}

function installFakeGateway() {
  FakeSocket.instances = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ticket: 't' }), { status: 200 })))
}

describe('Hermes timestamps', () => {
  it('normalizes Unix seconds returned by the session API', () => {
    expect(normalizeTimestamp(1_786_657_200, 0)).toBe(1_786_657_200_000)
    expect(normalizeTimestamp('1786657200', 0)).toBe(1_786_657_200_000)
  })

  it('preserves milliseconds, parses ISO dates, and falls back safely', () => {
    expect(normalizeTimestamp(1_786_657_200_000, 0)).toBe(1_786_657_200_000)
    expect(normalizeTimestamp('2026-08-13T21:00:00Z', 0)).toBe(Date.parse('2026-08-13T21:00:00Z'))
    expect(normalizeTimestamp('not-a-date', 1234)).toBe(1234)
  })
})

describe('Hermes session sources', () => {
  it('preserves cron runs as a distinct session type', () => {
    expect(normalizeSessionSource('cron')).toBe('cron')
    expect(normalizeSessionSource('cli')).toBe('tui')
    expect(normalizeSessionSource('api')).toBe('web')
  })
})

describe('DemoHermesClient', () => {
  it('creates conversations under the selected profile', async () => {
    const client = new DemoHermesClient()
    const conversation = await client.createConversation('coder')
    expect(conversation.profileId).toBe('coder')
    expect(conversation.messages).toEqual([])
  })

  it('streams lifecycle and message events', async () => {
    const client = new DemoHermesClient()
    const conversation = await client.createConversation('research')
    const events: string[] = []
    const unsubscribe = client.subscribe((event) => events.push(String(event.method)))
    await client.submit('research', conversation.id, 'Summarize this')
    unsubscribe()
    expect(events[0]).toBe('session.status')
    expect(events).toContain('message.delta')
    expect(events.at(-1)).toBe('message.complete')
  })

  it('returns isolated copies of demo data', async () => {
    const client = new DemoHermesClient()
    const first = await client.listProfiles()
    first[0].name = 'Changed'
    const second = await client.listProfiles()
    expect(second[0].name).toBe('Hermes')
  })
})

describe('DashboardHermesClient session resume', () => {
  it('resumes a reaped session, retries once, and reuses the live id afterward', async () => {
    const client = new DashboardHermesClient()
    const calls: { method: string; params: Record<string, unknown> }[] = []
    const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      calls.push({ method, params })
      if (method === 'prompt.submit' && params.session_id === 'stored-1') throw new Error('session not found')
      if (method === 'session.resume') return { session_id: 'live-2' }
      return {}
    })
    Object.assign(client, { request })

    await client.submit('coder', 'stored-1', 'hello')

    expect(calls.map((c) => c.method)).toEqual(['prompt.submit', 'session.resume', 'prompt.submit'])
    expect(calls[1].params).toMatchObject({ session_id: 'stored-1', profile: 'coder', source: 'web', omit_messages: true })
    expect(calls[2].params.session_id).toBe('live-2')

    await client.interrupt('coder', 'stored-1')
    expect(calls.at(-1)).toEqual({ method: 'session.interrupt', params: { profile: 'coder', session_id: 'live-2' } })
    client.dispose()
  })

  it('remaps a resumed session id back to the stored id in incoming gateway events', async () => {
    const client = new DashboardHermesClient()
    const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (method === 'prompt.submit' && params.session_id === 'stored-1') throw new Error('session not found')
      if (method === 'session.resume') return { session_id: 'live-2' }
      return {}
    })
    Object.assign(client, { request })

    const events: unknown[] = []
    client.subscribe((event) => events.push(event))
    await client.submit('coder', 'stored-1', 'hello')

    type ClientWithReceive = { receive: (message: unknown) => void }
    ;(client as unknown as ClientWithReceive).receive({ method: 'message.delta', params: { session_id: 'live-2', delta: 'hi' } })

    expect((events[0] as { params: { session_id: string } }).params.session_id).toBe('stored-1')
    client.dispose()
  })
})

describe('DashboardHermesClient reconnection', () => {
  let client: DashboardHermesClient

  afterEach(() => { client.dispose(); vi.unstubAllGlobals(); vi.useRealTimers() })

  it('automatically reconnects after the socket closes unexpectedly', async () => {
    installFakeGateway()
    client = new DashboardHermesClient()

    client.submit('coder', 'session-1', 'hello').catch(() => undefined)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    FakeSocket.instances[0].open()

    // Connection dies silently (e.g. laptop sleep) without any user action.
    FakeSocket.instances[0].close()

    await vi.waitFor(() => expect(FakeSocket.instances.length).toBeGreaterThan(1), { timeout: 20_000 })
  }, 20_000)

  it('forces a fresh connection when the tab becomes visible again', async () => {
    installFakeGateway()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    client = new DashboardHermesClient()

    client.submit('coder', 'session-1', 'hello').catch(() => undefined)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    FakeSocket.instances[0].open()
    expect(FakeSocket.instances[0].readyState).toBe(FakeSocket.OPEN)

    // The socket is a zombie: readyState still reports OPEN even though it's dead.
    // Waking the tab should not trust that and should force a reconnect.
    document.dispatchEvent(new Event('visibilitychange'))
    expect(FakeSocket.instances[0].readyState).toBe(FakeSocket.CLOSED)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))
  })

  it('ignores a superseded socket\'s belated close event instead of tearing down the new connection', async () => {
    // Real browsers close a socket asynchronously: readyState flips to CLOSING
    // immediately but onclose fires later. installFakeGateway's FakeSocket closes
    // synchronously and can't exercise that race, so this test uses its own.
    class AsyncCloseSocket extends FakeSocket {
      close() {
        this.readyState = FakeSocket.CLOSING
        setTimeout(() => { this.readyState = FakeSocket.CLOSED; this.onclose?.() }, 10)
      }
    }
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', AsyncCloseSocket)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ticket: 't' }), { status: 200 })))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    client = new DashboardHermesClient()

    client.submit('coder', 'session-1', 'hello').catch(() => undefined)
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1))
    FakeSocket.instances[0].open()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Wake forces socket A to close and immediately opens socket B in its place.
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2))

    // A request goes out against B while it's still connecting.
    client.interrupt('coder', 'session-1').catch(() => undefined)
    FakeSocket.instances[1].open()

    // A's belated onclose fires after B has already taken over.
    await new Promise((resolve) => setTimeout(resolve, 20))

    // It must not have reset connectPromise/pending state or spawned a third socket.
    expect(FakeSocket.instances).toHaveLength(2)
  })
})
