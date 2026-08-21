import { describe, expect, it } from 'vitest'
import { emojiFromSeed, firstGrapheme, initialConversations, normalizeProfileEmoji, profiles } from './data'

describe('demo domain data', () => {
  it('generates deterministic profile emoji and migrates old recipes', () => {
    expect(emojiFromSeed(42)).toEqual(emojiFromSeed(42))
    expect(emojiFromSeed(42)).not.toEqual(emojiFromSeed(43))
    expect(normalizeProfileEmoji({ seed: 42 }, '✨')).toBe(emojiFromSeed(42))
  })

  it('keeps one complete emoji grapheme from keyboard input', () => {
    expect(firstGrapheme('  👩🏽‍💻 🎉 ')).toBe('👩🏽‍💻')
    expect(firstGrapheme('')).toBe('')
  })

  it('keeps profile and conversation ownership valid', () => {
    const profileIds = new Set(profiles.map((profile) => profile.id))
    expect(initialConversations.every((conversation) => profileIds.has(conversation.profileId))).toBe(true)
  })

  it('includes active and approval states for parallel-run UX', () => {
    expect(initialConversations.some((conversation) => conversation.runState === 'streaming')).toBe(true)
    expect(initialConversations.some((conversation) => conversation.runState === 'awaiting_input' && conversation.request)).toBe(true)
  })
})
