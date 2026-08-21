import { Check, X } from 'lucide-react'
import { useEffect } from 'react'
import type { HermesProfile } from '../types'
import { Avatar } from './Avatar'

export function ProfilePicker({ profiles, currentProfileId, onClose, onSelect }: {
  profiles: HermesProfile[]
  currentProfileId?: string
  onClose: () => void
  onSelect: (profileId: string) => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    addEventListener('keydown', closeOnEscape)
    return () => removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="profile-picker" role="dialog" aria-modal="true" aria-labelledby="profile-picker-title">
      <div className="profile-picker-header"><div><span className="eyebrow">New conversation</span><h2 id="profile-picker-title">Choose a profile</h2><p>Pick the Hermes profile best suited to this conversation.</p></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19}/></button></div>
      <div className="profile-picker-grid">
        {profiles.map((profile) => <button key={profile.id} className="profile-picker-option" onClick={() => onSelect(profile.id)}>
          <Avatar emoji={profile.avatar} size={52}/>
          <span><strong>{profile.name}</strong><small>{profile.description}</small><em>{profile.model}</em></span>
          {profile.id === currentProfileId && <i title="Current profile"><Check size={15}/></i>}
        </button>)}
      </div>
    </section>
  </div>
}
