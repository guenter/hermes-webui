import { AlertCircle, ArrowUp, Check, ChevronDown, Command, Loader2, Paperclip, Square, WandSparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createId } from '../id'
import type { HermesProfile, RunState } from '../types'
import { Avatar } from './Avatar'

const commands = [
  { value: '/new', label: 'New conversation', hint: 'Start fresh' },
  { value: '/model', label: 'Switch model', hint: 'Choose a different model' },
  { value: '/compress', label: 'Compress context', hint: 'Make room in a long session' },
  { value: '/details', label: 'Toggle details', hint: 'Show or hide agent activity' },
]

type Attachment = { id: string; name: string; status: 'uploading' | 'ready' | 'error'; refText?: string; error?: string }

export function Composer({ profile, profiles = [], value, onChange, onSend, onStop, onSwitchAgent, onAttachFile, state }: {
  profile: HermesProfile
  profiles?: HermesProfile[]
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  onSwitchAgent?: (profileId: string) => void
  onAttachFile?: (file: File) => Promise<{ name: string; refText: string }>
  state: RunState
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const slashOpen = value.startsWith('/') && !value.includes(' ')
  const busy = state === 'streaming' || state === 'queued' || state === 'interrupting'
  const submit = () => { if (value.trim()) onSend() }

  useEffect(() => {
    if (!agentMenuOpen && !attachMenuOpen) return
    const closeOnOutside = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) { setAgentMenuOpen(false); setAttachMenuOpen(false) } }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAgentMenuOpen(false); setAttachMenuOpen(false) } }
    addEventListener('mousedown', closeOnOutside); addEventListener('keydown', closeOnEscape)
    return () => { removeEventListener('mousedown', closeOnOutside); removeEventListener('keydown', closeOnEscape) }
  }, [agentMenuOpen, attachMenuOpen])

  const insertText = (text: string) => {
    const el = inputRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const insertion = `${text} `
    onChange(value.slice(0, start) + insertion + value.slice(end))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + insertion.length, start + insertion.length) })
  }

  const attachFiles = async (fileList: File[]) => {
    for (const file of fileList) {
      const id = createId()
      setAttachments((current) => [...current, { id, name: file.name, status: 'uploading' }])
      try {
        if (!onAttachFile) throw new Error('Not connected')
        const result = await onAttachFile(file)
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, status: 'ready', name: result.name, refText: result.refText } : item))
        insertText(result.refText)
      } catch (cause) {
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, status: 'error', error: cause instanceof Error ? cause.message : 'Attach failed' } : item))
      }
    }
  }

  const removeAttachment = (attachment: Attachment) => {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id))
    if (attachment.refText && value.includes(attachment.refText)) onChange(value.replace(`${attachment.refText} `, '').replace(attachment.refText, ''))
  }

  const readyAttachments = attachments.filter((item) => item.status === 'ready')

  return <div className="composer-wrap">
    {busy && <div className="working-banner" role="status"><span className="working-dot"/>{profile.name} is working…</div>}
    {slashOpen && <div className="slash-menu"><div className="slash-title"><Command size={14}/> Commands</div>{commands.filter((command) => command.value.startsWith(value)).map((command) => <button key={command.value} onClick={() => { onChange(`${command.value} `); inputRef.current?.focus() }}><code>{command.value}</code><span>{command.label}<small>{command.hint}</small></span></button>)}</div>}
    <form className={`composer ${busy ? 'busy' : ''}`} onSubmit={(event) => { event.preventDefault(); submit() }}>
      {attachments.length > 0 && <div className="attachments">{attachments.map((attachment) => <span key={attachment.id} className={attachment.status}>
        {attachment.status === 'uploading' ? <Loader2 size={13} className="spin"/> : attachment.status === 'error' ? <AlertCircle size={13}/> : <span>📎</span>}
        {attachment.status === 'error' ? `${attachment.name} failed` : attachment.name}
        <button type="button" onClick={() => removeAttachment(attachment)} aria-label={`Remove ${attachment.name}`}><X size={12}/></button>
      </span>)}</div>}
      <textarea ref={inputRef} value={value} rows={1} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }} placeholder={`Message ${profile.name}`} aria-label={`Message ${profile.name}`}/>
      <div className="composer-actions">
        <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <input ref={fileRef} type="file" hidden multiple onChange={(event) => { attachFiles(Array.from(event.target.files ?? [])); event.target.value = '' }}/>
          <button type="button" aria-label="Attach or mention a file" aria-expanded={attachMenuOpen} onClick={() => { setAttachMenuOpen((open) => !open); setAgentMenuOpen(false) }}><Paperclip size={18}/></button>
          <button type="button" className="mode-button" aria-expanded={agentMenuOpen} onClick={() => { setAgentMenuOpen((open) => !open); setAttachMenuOpen(false) }}><WandSparkles size={15}/> {profile.name} <ChevronDown size={13}/></button>
          {attachMenuOpen && <div className="composer-popover mention-popover">
            <button type="button" onClick={() => { setAttachMenuOpen(false); fileRef.current?.click() }}><Paperclip size={15}/><span>Attach a file<small>Upload and reference it in your message</small></span></button>
            {readyAttachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => { insertText(attachment.refText!); setAttachMenuOpen(false) }}>📎<span>{attachment.name}<small>Mention this file again</small></span></button>)}
          </div>}
          {agentMenuOpen && <div className="composer-popover agent-popover">
            {profiles.map((item) => <button type="button" key={item.id} onClick={() => { setAgentMenuOpen(false); if (item.id !== profile.id) onSwitchAgent?.(item.id) }}>
              <Avatar emoji={item.avatar} size={26}/><span>{item.name}<small>{item.description}</small></span>{item.id === profile.id && <Check size={15}/>}
            </button>)}
          </div>}
        </div>
        {busy ? <button type="button" className="send-button stop" onClick={onStop} aria-label="Stop response"><Square size={13} fill="currentColor"/></button> : <button type="submit" className="send-button" disabled={!value.trim()} aria-label="Send message"><ArrowUp size={18}/></button>}
      </div>
    </form>
    <div className="composer-note">Hermes can make mistakes. Check important work.</div>
  </div>
}
