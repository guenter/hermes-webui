import { describe, expect, it, vi } from 'vitest'
import { DashboardHermesClient, DemoHermesClient, normalizeSessionSource, normalizeTimestamp } from './hermes-client'

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
  })
})
