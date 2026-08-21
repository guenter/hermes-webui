import { Archive, CalendarClock, Command, MessageSquare, MessageSquarePlus, PanelLeftClose, Search, Settings2, Sparkles } from 'lucide-react'
import { matchesSessionFilter } from '../session-filter'
import type { Conversation, HermesProfile, SessionFilter } from '../types'
import { Avatar } from './Avatar'

const relativeTime = (time: number) => {
  const safeTime = Number.isFinite(time) ? time : Date.now()
  const minutes = Math.round(Math.max(0, Date.now() - safeTime) / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function LiveMark({ state }: { state: Conversation['runState'] }) {
  if (state === 'streaming' || state === 'queued') return <span className="live-mark" title="Hermes is working"><span /></span>
  if (state === 'awaiting_input') return <span className="attention-mark">!</span>
  if (state === 'failed') return <span className="error-mark">×</span>
  return null
}

export function Rail({ profiles, conversations, activeId, filter, sessionFilter, search, onSelect, onFilter, onSessionFilter, onSearch, onNew, onClose, onCommand, onAvatar }: {
  profiles: HermesProfile[]; conversations: Conversation[]; activeId: string; filter: string; sessionFilter: SessionFilter; search: string
  onSelect: (id: string) => void; onFilter: (id: string) => void; onSessionFilter: (filter: SessionFilter) => void; onSearch: (value: string) => void; onNew: () => void; onClose: () => void; onCommand: () => void; onAvatar: (profile: HermesProfile) => void
}) {
  const visible = conversations.filter((item) => matchesSessionFilter(item, sessionFilter) && (filter === 'all' || item.profileId === filter) && `${item.title} ${item.preview}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <aside className="rail">
      <div className="rail-top">
        <div className="brand"><div className="brand-mark"><Sparkles size={16}/></div><span>Hermes</span></div>
        <button className="icon-button desktop-only" onClick={onClose} aria-label="Collapse sidebar"><PanelLeftClose size={18}/></button>
        <button className="icon-button mobile-only" onClick={onClose} aria-label="Close sidebar">×</button>
      </div>
      <button className="new-chat" onClick={onNew}><MessageSquarePlus size={18}/><span>New conversation</span><kbd>⌘ N</kbd></button>
      <div className="profile-strip" aria-label="Filter by profile">
        <button className={`all-profiles ${filter === 'all' ? 'active' : ''}`} onClick={() => onFilter('all')}>All</button>
        {profiles.map((profile) => <button key={profile.id} className={`profile-avatar-button ${filter === profile.id ? 'active' : ''}`} title={profile.name} onClick={() => onFilter(profile.id)} onDoubleClick={() => onAvatar(profile)}><Avatar emoji={profile.avatar} size={36}/></button>)}
      </div>
      <div className="session-filter" aria-label="Filter by session type">
        <button className={sessionFilter === 'all' ? 'active' : ''} onClick={() => onSessionFilter('all')} aria-pressed={sessionFilter === 'all'}>All</button>
        <button className={sessionFilter === 'user' ? 'active' : ''} onClick={() => onSessionFilter('user')} aria-pressed={sessionFilter === 'user'}><MessageSquare size={13}/> User</button>
        <button className={sessionFilter === 'cron' ? 'active' : ''} onClick={() => onSessionFilter('cron')} aria-pressed={sessionFilter === 'cron'}><CalendarClock size={13}/> Cron</button>
      </div>
      <label className="search-box"><Search size={16}/><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search conversations"/><kbd>⌘ K</kbd></label>
      <div className="rail-section-title"><span>Conversations</span><span>{visible.length}</span></div>
      <div className="conversation-list">
        {visible.map((conversation) => {
          const profile = profiles.find((item) => item.id === conversation.profileId) ?? profiles[0]
          return <button key={conversation.id} className={`conversation-row ${conversation.source === 'cron' ? 'cron' : 'user-session'} ${activeId === conversation.id ? 'active' : ''}`} onClick={() => onSelect(conversation.id)}>
            <div className="row-avatar"><Avatar emoji={profile.avatar} size={38}/>{conversation.source === 'cron' && <span className="cron-mark" title="Scheduled cron run"><CalendarClock size={9}/></span>}<LiveMark state={conversation.runState}/></div>
            <div className="row-copy"><div className="row-title"><span>{conversation.title}</span><time>{relativeTime(conversation.updatedAt)}</time></div><div className="row-preview">{conversation.preview || 'Start something new'}</div><div className="row-meta"><i style={{ background: profile.accent }}/>{profile.name}{conversation.source === 'cron' ? <span className="cron-label"><CalendarClock size={10}/> Scheduled</span> : conversation.source !== 'web' && <span>· {conversation.source}</span>}</div></div>
            {conversation.unread && <span className="unread-dot"/>}
          </button>
        })}
        {visible.length === 0 && <div className="rail-empty">No conversations found</div>}
      </div>
      <div className="rail-footer">
        <button onClick={() => onAvatar(profiles.find((p) => p.id === filter) ?? profiles[0])}><Archive size={17}/><span>Profile appearance</span></button>
        <button onClick={onCommand}><Command size={17}/><span>Command palette</span><kbd>⌘ K</kbd></button>
        <a href="/" target="_top" aria-label="Open Hermes dashboard"><Settings2 size={17}/><span>Dashboard</span></a>
      </div>
    </aside>
  )
}
