// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'

const profile = { id: 'hermes', name: 'Hermes', description: '', model: 'Hermes', accent: '#6f6af8', avatar: '✨' }

afterEach(cleanup)

describe('Composer submission', () => {
  it('submits the draft with Enter and the send button', () => {
    const onSend = vi.fn()
    const view = render(<Composer profile={profile} value="Hello" onChange={vi.fn()} onSend={onSend} onStop={vi.fn()} state="idle" />)

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)

    view.unmount()
    render(<Composer profile={profile} value="Hello" onChange={vi.fn()} onSend={onSend} onStop={vi.fn()} state="idle" />)
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(onSend).toHaveBeenCalledTimes(2)
  })

  it('allows sending a follow-up while the agent is still streaming', () => {
    const onSend = vi.fn()
    render(<Composer profile={profile} value="One more thing" onChange={vi.fn()} onSend={onSend} onStop={vi.fn()} state="streaming" />)

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
