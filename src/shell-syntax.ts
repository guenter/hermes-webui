export type ShellTokenKind = 'plain' | 'command' | 'keyword' | 'option' | 'string' | 'variable' | 'operator' | 'number' | 'comment'
export type ShellToken = { text: string; kind: ShellTokenKind }

const tokenPattern = /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*=[^\s|;&<>]+|--?[A-Za-z0-9][A-Za-z0-9_-]*(?:=[^\s|;&<>]+)?|&&|\|\||>>|<<|[|;<>]|\b\d+(?:\.\d+)?\b|[A-Za-z_./][A-Za-z0-9_./:@+-]*/g
const keywords = new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'in', 'function'])
const commandPrefixes = new Set(['sudo', 'env', 'command', 'time', 'xargs', 'exec'])

export function tokenizeShell(source: string): ShellToken[] {
  const tokens: ShellToken[] = []
  let cursor = 0
  let expectsCommand = true

  for (const match of source.matchAll(tokenPattern)) {
    const index = match.index ?? cursor
    const gap = source.slice(cursor, index)
    if (gap) {
      tokens.push({ text: gap, kind: 'plain' })
      if (gap.includes('\n')) expectsCommand = true
    }

    const text = match[0]
    let kind: ShellTokenKind = 'plain'
    if (text.startsWith('#')) kind = 'comment'
    else if (text.startsWith('"') || text.startsWith("'")) kind = 'string'
    else if (text.startsWith('$') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(text)) kind = 'variable'
    else if (text.startsWith('-')) kind = 'option'
    else if (/^(?:&&|\|\||>>|<<|[|;<>])$/.test(text)) kind = 'operator'
    else if (/^\d/.test(text)) kind = 'number'
    else if (keywords.has(text)) kind = 'keyword'
    else if (expectsCommand) kind = 'command'

    tokens.push({ text, kind })
    if (kind === 'operator') expectsCommand = /^(?:&&|\|\||\||;)$/.test(text)
    else if (kind === 'command') expectsCommand = commandPrefixes.has(text)
    else if (kind !== 'option' && kind !== 'variable' && kind !== 'comment') expectsCommand = false
    cursor = index + text.length
  }

  if (cursor < source.length) tokens.push({ text: source.slice(cursor), kind: 'plain' })
  return tokens
}
