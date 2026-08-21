import { ArrowRight, Command, Moon, Search, Settings2, Sun, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { HermesProfile } from '../types'
import { Avatar } from './Avatar'

export function CommandPalette({ profiles, onClose, onNew, onProfile, onTheme }: { profiles: HermesProfile[]; onClose: () => void; onNew: (profile: string) => void; onProfile: (profile: HermesProfile) => void; onTheme: (theme: 'light' | 'dark') => void }) {
  const [query, setQuery] = useState('')
  useEffect(() => { const handler = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); addEventListener('keydown', handler); return () => removeEventListener('keydown', handler) }, [onClose])
  const actions = useMemo(() => [
    ...profiles.map((profile) => ({ id: `new-${profile.id}`, label: `New chat with ${profile.name}`, hint: profile.description, icon: <Avatar emoji={profile.avatar} size={30}/>, run: () => onNew(profile.id) })),
    { id: 'profiles', label: 'Customize profiles', hint: 'Names, emoji, and colors', icon: <UserRound size={18}/>, run: () => onProfile(profiles[0]) },
    { id: 'light', label: 'Use light appearance', hint: 'Switch theme', icon: <Sun size={18}/>, run: () => onTheme('light') },
    { id: 'dark', label: 'Use dark appearance', hint: 'Switch theme', icon: <Moon size={18}/>, run: () => onTheme('dark') },
    { id: 'dashboard', label: 'Open Hermes dashboard', hint: 'Models, tools, and settings', icon: <Settings2 size={18}/>, run: () => { window.top?.location.assign('/') } },
  ], [profiles, onNew, onProfile, onTheme])
  const visible = actions.filter((action) => `${action.label} ${action.hint}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="modal-backdrop command-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="command-palette" role="dialog" aria-modal="true"><div className="command-input"><Search size={19}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What would you like to do?"/><kbd>esc</kbd></div><div className="command-results"><div className="command-group"><span>Quick actions</span>{visible.map((action, index) => <button key={action.id} className={index === 0 ? 'highlighted' : ''} onClick={() => { action.run(); onClose() }}><span className="command-action-icon">{action.icon}</span><span>{action.label}<small>{action.hint}</small></span><ArrowRight size={15}/></button>)}{visible.length === 0 && <div className="no-actions">No matching actions</div>}</div></div><footer><span><Command size={13}/>K to open</span><span>↑↓ navigate · ↵ select</span></footer></section></div>
}
