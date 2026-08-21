import { ChevronDown, Menu, PanelLeftOpen, Plus, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './components/Avatar'
import { ProfileEditor } from './components/ProfileEditor'
import { CommandPalette } from './components/CommandPalette'
import { Composer } from './components/Composer'
import { InteractiveCard } from './components/InteractiveCard'
import { Message } from './components/Message'
import { ProfilePicker } from './components/ProfilePicker'
import { Rail } from './components/Rail'
import { createHermesClient } from './hermes-client'
import { normalizeProfileEmoji } from './data'
import { displayText, gatewayEventData, interactiveRequestFromGateway } from './message-normalizer'
import { db, loadDraft, saveDraft } from './storage'
import { useAppStore } from './store'
import { createId } from './id'
import type { GatewayEvent, HermesClient, HermesProfile } from './types'

export function App() {
  const store = useAppStore()
  const [client, setClient] = useState<HermesClient>()
  const [demo, setDemo] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingProfile, setEditingProfile] = useState<HermesProfile>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [profilePickerOpen, setProfilePickerOpen] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const active = store.conversations.find((item) => item.id === store.activeConversationId)
  const profile = store.profiles.find((item) => item.id === active?.profileId) ?? store.profiles[0]

  useEffect(() => {
    createHermesClient().then(async ({ client: instance, demo: isDemo }) => {
      setClient(instance); setDemo(isDemo)
      try {
        const loadedProfiles = await instance.listProfiles()
        const presentations = await db.profilePresentations.toArray()
        const customized = loadedProfiles.map((item) => { const local = presentations.find((entry) => entry.profileId === item.id); return local ? { ...item, name: local.displayName ?? item.name, accent: local.accent, avatar: normalizeProfileEmoji(local.avatar, item.avatar) } : item })
        store.setProfiles(customized)
        const loadedConversations = await instance.listConversations()
        store.setConversations(loadedConversations)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load Hermes') }
      finally { setLoading(false) }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEvent = useCallback((event: GatewayEvent) => {
    const { method, data: params, sessionId: id } = gatewayEventData(event)
    if (!id) return
    const request = interactiveRequestFromGateway(method, params)
    if (request) {
      store.updateConversation(id, { request, runState: 'awaiting_input' })
    } else if (method === 'message.delta') {
      const text = displayText(params.text ?? params.delta)
      if (!text) return
      store.setRunState(id, 'streaming')
      store.appendAssistantText(id, text)
    } else if (method === 'message.complete' || method === 'session.complete') {
      // A turn that dies before producing any output (bad API key, no credits, a
      // provider rejection) still resolves this event — the gateway's only signal
      // that something went wrong is `status: "error"` + a short `error` string.
      // Without surfacing it the composer just goes quiet: "is working…" then
      // nothing, forever, with no indication why.
      if (params.status === 'error' || params.error) {
        store.appendNotice(id, 'error', String(params.error ?? 'The agent hit an error and could not finish.'))
        store.setRunState(id, 'failed')
      } else {
        store.setRunState(id, 'completed')
      }
    } else if (method === 'session.status') {
      store.setRunState(id, params.running ? 'streaming' : 'idle')
    } else if (method === 'tool.start') {
      const name = String(params.name ?? 'tool')
      store.setRunState(id, 'streaming')
      store.upsertTool(id, {
        id: String(params.tool_id ?? createId()),
        name,
        label: String(params.context ?? name.replaceAll('_', ' ')),
        input: params.args ?? params.args_text ?? params.context,
        status: 'running',
      })
    } else if (method === 'tool.complete') {
      const name = String(params.name ?? 'tool')
      const duration = typeof params.duration_s === 'number' ? `${params.duration_s.toFixed(1)}s` : undefined
      store.upsertTool(id, {
        id: String(params.tool_id ?? createId()),
        name,
        label: String(params.summary ?? params.context ?? name.replaceAll('_', ' ')),
        input: params.args ?? params.args_text ?? params.context,
        output: params.result ?? params.result_text ?? params.error ?? params.summary,
        status: params.error ? 'failed' : 'complete',
        duration,
      })
    }
  }, [store])

  useEffect(() => {
    if (!client) return
    return client.subscribe((event) => handleEvent(event))
  }, [client, handleEvent])

  useEffect(() => {
    if (!active) return
    loadDraft(active.id).then(setDraft)
    if (active.messages.length === 0 && client) client.getHistory(active.profileId, active.id).then((messages) => store.updateConversation(active.id, { messages })).catch(() => undefined)
  }, [active?.id, client])

  useEffect(() => { if (active) saveDraft(active.id, draft).catch(() => undefined) }, [active?.id, draft])
  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' }) }, [active?.messages, active?.request])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); store.setCommandOpen(true) }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); setProfilePickerOpen(true) }
    }
    addEventListener('keydown', handler); return () => removeEventListener('keydown', handler)
  }, [profile?.id, client])

  const makeConversation = async (profileId = store.profileFilter === 'all' ? profile?.id : store.profileFilter) => {
    if (!client || !profileId) return
    setProfilePickerOpen(false)
    const conversation = await client.createConversation(profileId)
    store.addConversation(conversation)
    store.setProfileFilter('all')
    store.setSessionFilter('user')
  }

  const send = async () => {
    if (!client || !active || !draft.trim()) return
    const text = draft.trim()
    const mid = active.runState === 'streaming' || active.runState === 'queued'
    const message = { id: createId(), role: 'user' as const, createdAt: Date.now(), blocks: [{ type: 'markdown' as const, text }] }
    store.updateConversation(active.id, { messages: [...active.messages, message], title: active.messages.length === 0 ? text.slice(0, 46) : active.title, preview: text, runState: mid ? active.runState : 'queued', updatedAt: Date.now() })
    setDraft(''); await saveDraft(active.id, '')
    const request = mid ? client.steer(active.profileId, active.id, text) : client.submit(active.profileId, active.id, text)
    request.catch((cause) => { store.setRunState(active.id, 'failed'); setError(cause instanceof Error ? cause.message : 'Message failed') })
  }

  const attachFile = async (file: File) => {
    if (!client || !active) throw new Error('Not connected')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'))
      reader.readAsDataURL(file)
    })
    return client.attachFile(active.profileId, active.id, { name: file.name, dataUrl })
  }

  const saveProfile = async (next: HermesProfile) => {
    store.updateProfile(next.id, next)
    await db.profilePresentations.put({ profileId: next.id, displayName: next.name, accent: next.accent, avatar: next.avatar })
    setEditingProfile(undefined)
  }

  const setTheme = (theme: 'light' | 'dark') => { document.documentElement.dataset.theme = theme; localStorage.setItem('hermes-theme', theme) }
  useEffect(() => { const saved = localStorage.getItem('hermes-theme'); if (saved === 'light' || saved === 'dark') setTheme(saved) }, [])

  const activeRuns = useMemo(() => store.conversations.filter((item) => item.runState === 'streaming' || item.runState === 'queued').length, [store.conversations])
  if (loading) return <div className="splash"><div className="splash-mark"><Sparkles/></div><span>Waking Hermes…</span></div>
  if (!profile || !active) return <><div className="empty-app"><Sparkles size={36}/><h1>Hermes is ready</h1><p>{error || 'Create a conversation to get started.'}</p>{store.profiles[0] && <button className="primary-button" onClick={() => setProfilePickerOpen(true)}>New conversation</button>}</div>{profilePickerOpen && <ProfilePicker profiles={store.profiles} currentProfileId={profile?.id} onClose={() => setProfilePickerOpen(false)} onSelect={makeConversation}/>}</>

  return <div className={`app-shell ${railCollapsed ? 'rail-collapsed' : ''}`}>
    <div className={`rail-shell ${store.railOpen ? 'open' : ''}`}><Rail profiles={store.profiles} conversations={store.conversations} activeId={active.id} filter={store.profileFilter} sessionFilter={store.sessionFilter} search={store.search} onSelect={store.setActiveConversation} onFilter={store.setProfileFilter} onSessionFilter={store.setSessionFilter} onSearch={store.setSearch} onNew={() => setProfilePickerOpen(true)} onClose={() => { setRailCollapsed(true); store.setRailOpen(false) }} onCommand={() => store.setCommandOpen(true)} onAvatar={(item) => { setEditingProfile(item); store.setAvatarOpen(true) }}/></div>
    {store.railOpen && <button className="rail-scrim" aria-label="Close sidebar" onClick={() => store.setRailOpen(false)}/>}
    <main className="chat-shell">
      <header className="chat-header">
        <div className="header-left">
          <button className="icon-button rail-open" onClick={() => { setRailCollapsed(false); store.setRailOpen(true) }} aria-label="Open conversations">{railCollapsed ? <PanelLeftOpen size={19}/> : <Menu size={20}/>}</button>
          <button className="profile-title" onClick={() => { setEditingProfile(profile); store.setAvatarOpen(true) }}><Avatar emoji={profile.avatar} size={38}/><span><strong>{profile.name}</strong></span><ChevronDown size={15}/></button>
        </div>
        <div className="header-center"><strong>{active.title}</strong><span>{active.model || profile.model}{activeRuns > 0 && <> · {activeRuns} active</>}</span></div>
        <div className="header-actions"><button className="new-header-button" onClick={() => setProfilePickerOpen(true)}><Plus size={17}/> <span>New</span></button></div>
      </header>
      {demo && <div className="demo-banner"><span>Preview mode</span> Connect through Hermes Dashboard to use your live profiles and history.<button onClick={() => setDemo(false)}>Dismiss</button></div>}
      {error && <div className="error-toast">{error}<button onClick={() => setError('')}>×</button></div>}
      <div className="transcript" ref={transcriptRef}>
        <div className="transcript-inner">
          {active.messages.length === 0 ? <Welcome profile={profile} onPrompt={setDraft}/> : active.messages.map((message) => <Message key={message.id} message={message} profile={profile}/>) }
          {active.request && <InteractiveCard
            request={active.request}
            onRespond={async (value) => { await client?.respond(active.profileId, active.id, active.request!, value); store.updateConversation(active.id, { request: undefined, runState: 'streaming' }) }}
          />}
          {active.runState === 'streaming' && active.messages[active.messages.length - 1]?.role !== 'assistant' && <div className="typing-row"><Avatar emoji={profile.avatar} size={32}/><span/><span/><span/></div>}
        </div>
      </div>
      <Composer profile={profile} profiles={store.profiles} value={draft} onChange={setDraft} onSend={send} state={active.runState} onSwitchAgent={makeConversation} onAttachFile={attachFile} onStop={async () => { store.setRunState(active.id, 'interrupting'); await client?.interrupt(active.profileId, active.id); store.setRunState(active.id, 'idle') }}/>
    </main>
    {store.commandOpen && <CommandPalette profiles={store.profiles} onClose={() => store.setCommandOpen(false)} onNew={makeConversation} onProfile={(item) => { setEditingProfile(item); store.setAvatarOpen(true) }} onTheme={setTheme}/>}
    {profilePickerOpen && <ProfilePicker profiles={store.profiles} currentProfileId={profile.id} onClose={() => setProfilePickerOpen(false)} onSelect={makeConversation}/>}
    {store.avatarOpen && editingProfile && <ProfileEditor key={editingProfile.id} profile={editingProfile} onClose={() => store.setAvatarOpen(false)} onSave={saveProfile}/>}
  </div>
}

function Welcome({ profile, onPrompt }: { profile: HermesProfile; onPrompt: (value: string) => void }) {
  const prompts = ['Plan a project with me', 'Research a topic deeply', 'Help me write something', 'Review my latest work']
  return <div className="welcome"><div className="welcome-avatar"><Avatar emoji={profile.avatar} size={88}/><span style={{ background: profile.accent }}/></div><h1>What are we working on?</h1><p>{profile.name} is ready with {profile.model}.</p><div className="prompt-grid">{prompts.map((prompt) => <button key={prompt} onClick={() => onPrompt(prompt)}><SlidersHorizontal size={16}/>{prompt}</button>)}</div></div>
}
