import { describe, expect, it } from 'vitest'
import { tokenizeShell } from './shell-syntax'

describe('shell syntax highlighting', () => {
  it('identifies commands, flags, strings, variables, and operators', () => {
    const tokens = tokenizeShell('npm test -- --grep "profile filter" && echo $HOME')
    expect(tokens).toContainEqual({ text: 'npm', kind: 'command' })
    expect(tokens).toContainEqual({ text: '--grep', kind: 'option' })
    expect(tokens).toContainEqual({ text: '"profile filter"', kind: 'string' })
    expect(tokens).toContainEqual({ text: '&&', kind: 'operator' })
    expect(tokens).toContainEqual({ text: 'echo', kind: 'command' })
    expect(tokens).toContainEqual({ text: '$HOME', kind: 'variable' })
  })

  it('highlights commands after pipes and on new lines', () => {
    const commands = tokenizeShell('cat app.log | tail -n 20\nprintf done').filter((token) => token.kind === 'command').map((token) => token.text)
    expect(commands).toEqual(['cat', 'tail', 'printf'])
  })

  it('keeps comments distinct from executable text', () => {
    expect(tokenizeShell('npm test # focused suite')).toContainEqual({ text: '# focused suite', kind: 'comment' })
  })
})
