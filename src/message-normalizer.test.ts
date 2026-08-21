import { describe, expect, it } from 'vitest'
import { displayText, gatewayEventData, interactiveRequestFromGateway, normalizeHistory, normalizeHistoryMessage } from './message-normalizer'

describe('message normalization', () => {
  it('extracts text from native and serialized content blocks', () => {
    expect(displayText([{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }])).toBe('Hello world')
    expect(displayText('[{"type":"text","text":"Visible answer"}]')).toBe('Visible answer')
  })

  it('preserves intentional JSON prose', () => {
    expect(displayText('{"answer":42}')).toBe('{"answer":42}')
  })

  it('renders tool rows as collapsed tool blocks instead of message JSON', () => {
    const message = normalizeHistoryMessage({ role: 'tool', tool_name: 'terminal', content: '{"exit_code":0,"output":"done"}' }, 'session', 0)
    expect(message?.blocks[0].type).toBe('tool')
    expect(message?.blocks.some((block) => block.type === 'markdown')).toBe(false)
  })

  it('ignores hidden transcript scaffolding', () => {
    expect(normalizeHistoryMessage({ role: 'user', content: '{"internal":true}', display_kind: 'hidden' }, 'session', 0)).toBeNull()
  })

  it('reads the payload-style gateway envelope used by Hermes', () => {
    expect(gatewayEventData({ type: 'message.delta', session_id: 'abc', payload: { text: 'Hi' } })).toEqual({
      method: 'message.delta', data: { text: 'Hi' }, sessionId: 'abc',
    })
  })

  it('unwraps JSON-RPC event envelopes from the WebSocket gateway', () => {
    expect(gatewayEventData({ method: 'event', params: { type: 'message.delta', payload: { session_id: 'abc', text: 'Hi' } } })).toEqual({
      method: 'message.delta', data: { session_id: 'abc', text: 'Hi' }, sessionId: 'abc',
    })
  })

  it('retains the session ID when the gateway puts it beside the event payload', () => {
    expect(gatewayEventData({ method: 'event', params: { type: 'message.delta', session_id: 'abc', payload: { text: 'Hi' } } })).toEqual({
      method: 'message.delta', data: { text: 'Hi' }, sessionId: 'abc',
    })
  })

  it('maps gateway approvals to an interactive request', () => {
    expect(interactiveRequestFromGateway('approval.request', { command: 'git status', choices: ['once', 'deny'] })).toEqual({
      id: 'approval-request', kind: 'approval', title: 'Approval required', description: 'git status', options: ['once', 'deny'],
    })
  })

  it('groups assistant tool work and the following prose into one reply', () => {
    const messages = normalizeHistory([
      { role: 'user', content: 'Check the build' },
      { role: 'assistant', content: 'I’ll run it.', tool_calls: [{ id: 'call-1', function: { name: 'terminal', arguments: '{"command":"npm test"}' } }] },
      { role: 'tool', tool_call_id: 'call-1', tool_name: 'terminal', content: '{"output":"11 passed","exit_code":0}' },
      { role: 'assistant', content: 'Everything passes.' },
    ], 'session')

    expect(messages).toHaveLength(2)
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].blocks.map((block) => block.type)).toEqual(['markdown', 'tool', 'markdown'])
    const tool = messages[1].blocks.find((block) => block.type === 'tool')
    expect(tool?.type === 'tool' && tool.tool).toMatchObject({ status: 'complete', input: { command: 'npm test' }, output: { output: '11 passed', exit_code: 0 } })
  })
})
