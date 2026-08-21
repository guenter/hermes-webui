import { describe, expect, it } from 'vitest'
import { presentTool } from './tool-presentation'

describe('tool presentation', () => {
  it('turns terminal JSON into named human-readable fields', () => {
    const view = presentTool({ id: '1', name: 'terminal', label: 'terminal', status: 'complete', input: { command: 'npm test' }, output: { output: '11 passed', exit_code: 0 } })
    expect(view.title).toBe('Ran a command')
    expect(view.summary).toBe('npm test')
    expect(view.fields).toEqual([
      { label: 'Command', value: 'npm test', kind: 'command' },
      { label: 'Output', value: '11 passed', kind: 'output' },
      { label: 'Exit status', value: '0', kind: 'text' },
    ])
  })

  it('presents file reads without JSON punctuation', () => {
    const view = presentTool({ id: '2', name: 'read_file', label: 'read file', status: 'complete', input: '{"path":"src/App.tsx"}', output: '{"content":"export function App() {}"}' })
    expect(view.summary).toBe('src/App.tsx')
    expect(view.fields).toEqual([
      { label: 'File', value: 'src/App.tsx', kind: 'code' },
      { label: 'Contents', value: 'export function App() {}', kind: 'output' },
    ])
  })

  it('keeps plain-text terminal output in the readable output field', () => {
    const view = presentTool({ id: '3', name: 'terminal', label: 'terminal', status: 'complete', input: 'npm test', output: '14 tests passed' })
    expect(view.fields).toContainEqual({ label: 'Output', value: '14 tests passed', kind: 'output' })
  })

  it('presents Hermes web search results as titled entries', () => {
    const view = presentTool({
      id: '4', name: 'web_search', label: 'search', status: 'complete', input: '{"query":"AI accelerators"}',
      output: JSON.stringify({ success: true, data: { web: [
        { title: 'NVIDIA Blackwell', url: 'https://nvidia.com/blackwell', description: 'Official architecture overview.', position: 1 },
        { title: 'AMD Instinct', url: 'https://amd.com/instinct', description: 'Accelerator product details.', position: 2 },
      ] } }),
    })
    expect(view.fields).toEqual([
      { label: 'Search', value: 'AI accelerators', kind: 'text' },
      { label: '1. NVIDIA Blackwell', value: 'https://nvidia.com/blackwell\nOfficial architecture overview.', kind: 'text' },
      { label: '2. AMD Instinct', value: 'https://amd.com/instinct\nAccelerator product details.', kind: 'text' },
    ])
    expect(view.fields.map((item) => item.value).join('\n')).not.toContain('"success"')
  })

  it('presents extracted web pages without the JSON envelope', () => {
    const view = presentTool({
      id: '5', name: 'web_extract', label: 'read pages', status: 'complete', input: { urls: ['https://example.com/specs'] },
      output: JSON.stringify({ results: [{ url: 'https://example.com/specs', title: 'Accelerator specifications', content: 'Memory bandwidth is 8 TB/s.', error: null }] }),
    })
    expect(view.fields).toEqual([
      { label: '1. Accelerator specifications', value: 'https://example.com/specs\nMemory bandwidth is 8 TB/s.', kind: 'text' },
    ])
    expect(view.fields[0].value).not.toContain('"results"')
  })
})
