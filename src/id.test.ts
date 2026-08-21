import { describe, expect, it, vi } from 'vitest'
import { createId } from './id'

describe('createId', () => {
  it('uses a UUID v4 fallback when randomUUID is unavailable', () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: vi.fn((bytes: Uint8Array) => bytes.fill(0)) } })

    expect(createId()).toBe('00000000-0000-4000-8000-000000000000')

    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: original })
  })
})
