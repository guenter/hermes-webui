import type { Conversation, HermesProfile } from './types'

export const profileEmojis = ['✨', '🔭', '🛠️', '🎨', '🧠', '🧭', '📚', '🎧', '🌱', '⚡', '🦊', '🐙']

export const emojiFromSeed = (seed: number) => profileEmojis[Math.abs(seed) % profileEmojis.length]

export function firstGrapheme(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed)][0]?.segment ?? ''
}

export function normalizeProfileEmoji(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return firstGrapheme(value)
  if (value && typeof value === 'object' && 'seed' in value && typeof (value as { seed?: unknown }).seed === 'number') return emojiFromSeed((value as { seed: number }).seed)
  return fallback
}

export const profiles: HermesProfile[] = [
  { id: 'default', name: 'Hermes', description: 'Everyday copilot', model: 'Hermes 4 · 405B', accent: '#6f6af8', avatar: '✨' },
  { id: 'research', name: 'Scout', description: 'Research & synthesis', model: 'Claude Sonnet 4', accent: '#ef805f', avatar: '🔭' },
  { id: 'coder', name: 'Forge', description: 'Engineering partner', model: 'GPT-5.2 Codex', accent: '#25a783', avatar: '🛠️' },
  { id: 'creative', name: 'Muse', description: 'Writing & ideation', model: 'Gemini 2.5 Pro', accent: '#d45c92', avatar: '🎨' },
]

const now = Date.now()

export const initialConversations: Conversation[] = [
  {
    id: 'welcome', profileId: 'default', title: 'Planning the week', preview: 'Here’s a focused plan for the week ahead…', updatedAt: now - 1000 * 60 * 2,
    source: 'web', model: 'Hermes 4 · 405B', unread: false, runState: 'idle',
    messages: [
      { id: 'w1', role: 'user', createdAt: now - 180000, blocks: [{ type: 'markdown', text: 'Help me turn my scattered notes into a focused plan for the week.' }] },
      { id: 'w2', role: 'assistant', createdAt: now - 120000, blocks: [
        { type: 'thinking', text: 'I’ll group the notes by outcome, then sequence the work around the two fixed commitments.' },
        { type: 'tool', tool: { id: 't1', name: 'read_file', label: 'Read weekly-notes.md', status: 'complete', duration: '0.4s', input: '~/notes/weekly-notes.md', output: 'Found 18 notes across product, hiring, and personal admin.' } },
        { type: 'markdown', text: 'Here’s a focused plan that protects your mornings for deep work and keeps the administrative tasks contained.\n\n### Monday–Tuesday\n\n1. Finish the **onboarding prototype** while the requirements are fresh.\n2. Send the hiring scorecards by Tuesday afternoon.\n\n### Wednesday–Friday\n\n- Review customer research with Scout.\n- Keep Friday afternoon open for loose ends and next-week planning.\n\nThe important tradeoff: defer the analytics cleanup. It matters, but it doesn’t unblock anyone this week.' },
      ] },
    ],
  },
  {
    id: 'market', profileId: 'research', title: 'AI hardware market scan', preview: 'Comparing the strongest primary sources…', updatedAt: now - 1000 * 45,
    source: 'web', model: 'Claude Sonnet 4', unread: true, runState: 'streaming',
    messages: [
      { id: 'm1', role: 'user', createdAt: now - 90000, blocks: [{ type: 'markdown', text: 'Compare the current AI accelerator landscape. Focus on primary sources.' }] },
      { id: 'm2', role: 'assistant', createdAt: now - 35000, blocks: [
        { type: 'thinking', text: 'I’m prioritizing vendor disclosures and benchmark methodology over commentary.' },
        { type: 'tool', tool: { id: 't2', name: 'web_search', label: 'Search official product briefs', status: 'complete', duration: '1.2s', input: { query: 'official AI accelerator product briefs' }, output: { success: true, data: { web: [
          { title: 'NVIDIA Blackwell Architecture', url: 'https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/', description: 'Official overview of the Blackwell platform.' },
          { title: 'AMD Instinct MI300X', url: 'https://www.amd.com/en/products/accelerators/instinct/mi300/mi300x.html', description: 'Product specifications for AMD Instinct MI300X.' },
        ] } } } },
        { type: 'tool', tool: { id: 't3', name: 'web_extract', label: 'Read accelerator specifications', status: 'complete', duration: '0.9s', input: { urls: ['https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/'] }, output: { results: [{ url: 'https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/', title: 'NVIDIA Blackwell Architecture', content: 'Blackwell combines accelerated computing and high-bandwidth memory for large AI workloads.', error: null }] } } },
        { type: 'markdown', text: 'The primary sources point to a market differentiating on memory capacity, interconnect, and full-stack availability—not just peak compute. I’ll use those dimensions for the comparison.' },
      ] },
    ],
  },
  {
    id: 'auth', profileId: 'coder', title: 'Fix flaky auth tests', preview: 'The race is in token refresh teardown…', updatedAt: now - 1000 * 60 * 24,
    source: 'tui', model: 'GPT-5.2 Codex', unread: false, runState: 'completed',
    messages: [
      { id: 'a1', role: 'user', createdAt: now - 90000000, blocks: [{ type: 'markdown', text: 'Find the source of the flaky authentication test. Don’t change anything yet.' }] },
      { id: 'a2', role: 'assistant', createdAt: now - 89900000, blocks: [
        { type: 'tool', tool: { id: 't4', name: 'search', label: 'Search authentication tests', status: 'complete', duration: '0.2s', output: 'Found 7 relevant files.' } },
        { type: 'tool', tool: { id: 't5', name: 'terminal', label: 'Run focused test suite', status: 'complete', duration: '8.4s', input: 'npm test -- auth --repeat=20', output: '1 failure in 20 runs' } },
        { type: 'markdown', text: 'The race is in token refresh teardown. The test resolves when the cookie is written, but cleanup can close the mock server before the refresh request finishes. Moving teardown behind the pending-request barrier should remove the flake.' },
      ] },
    ],
  },
  {
    id: 'morning-digest', profileId: 'research', title: 'Morning research digest', preview: 'Scheduled scan completed with three notable updates…', updatedAt: now - 1000 * 60 * 38,
    source: 'cron', model: 'Claude Sonnet 4', unread: false, runState: 'completed',
    messages: [
      { id: 'c1', role: 'assistant', createdAt: now - 1000 * 60 * 38, blocks: [{ type: 'markdown', text: 'The scheduled morning scan completed with three notable updates across model releases, infrastructure, and regulation.' }] },
    ],
  },
  {
    id: 'launch', profileId: 'creative', title: 'Launch announcement', preview: 'Three directions, from direct to playful', updatedAt: now - 1000 * 60 * 60 * 26,
    source: 'telegram', model: 'Gemini 2.5 Pro', unread: false, runState: 'idle',
    messages: [
      { id: 'l1', role: 'user', createdAt: now - 100000000, blocks: [{ type: 'markdown', text: 'Draft a warm launch announcement for our small beta group.' }] },
      { id: 'l2', role: 'assistant', createdAt: now - 99900000, blocks: [{ type: 'markdown', text: 'I’d frame this as an invitation rather than an announcement. The beta group should feel like collaborators, not an audience.' }] },
    ],
  },
  {
    id: 'approval', profileId: 'coder', title: 'Deploy preview build', preview: 'Approval needed to continue', updatedAt: now - 1000 * 60 * 5,
    source: 'web', model: 'GPT-5.2 Codex', unread: true, runState: 'awaiting_input',
    request: { id: 'req-1', kind: 'approval', title: 'Allow deployment command?', description: 'Forge wants to run `npm run deploy:preview`. This will publish a temporary preview build.', options: ['Allow once', 'Always allow', 'Deny'] },
    messages: [
      { id: 'p1', role: 'user', createdAt: now - 400000, blocks: [{ type: 'markdown', text: 'Deploy the current branch to a preview environment.' }] },
      { id: 'p2', role: 'assistant', createdAt: now - 300000, blocks: [{ type: 'tool', tool: { id: 't6', name: 'terminal', label: 'Deploy preview build', status: 'running', input: 'npm run deploy:preview' } }] },
    ],
  },
]
