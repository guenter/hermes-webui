import { describe, expect, it } from 'vitest'
import { matchesSessionFilter } from './session-filter'
import type { Conversation } from './types'

const conversation = (source: Conversation['source']) => ({ source } as Conversation)

describe('session type filters', () => {
  it('separates scheduled cron runs from user sessions', () => {
    expect(matchesSessionFilter(conversation('cron'), 'cron')).toBe(true)
    expect(matchesSessionFilter(conversation('cron'), 'user')).toBe(false)
    expect(matchesSessionFilter(conversation('web'), 'user')).toBe(true)
    expect(matchesSessionFilter(conversation('tui'), 'user')).toBe(true)
  })

  it('keeps every source in the all filter', () => {
    expect(['web', 'tui', 'telegram', 'cron'].every((source) => matchesSessionFilter(conversation(source as Conversation['source']), 'all'))).toBe(true)
  })
})
