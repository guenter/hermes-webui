import { Check, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { firstGrapheme } from '../data'
import type { HermesProfile } from '../types'
import { Avatar } from './Avatar'

const accents = ['#6f6af8', '#ef805f', '#25a783', '#d45c92', '#4388d8', '#b06ce1']

export function ProfileEditor({ profile, onClose, onSave }: { profile: HermesProfile; onClose: () => void; onSave: (profile: HermesProfile) => void }) {
  const [name, setName] = useState(profile.name)
  const [accent, setAccent] = useState(profile.accent)
  const [emoji, setEmoji] = useState(profile.avatar)

  const reset = () => { setName(profile.name); setAccent(profile.accent); setEmoji(profile.avatar) }
  const selectedEmoji = firstGrapheme(emoji) || profile.avatar

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
      <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19}/></button>
      <div className="profile-editor-header">
        <span className="eyebrow">Profile appearance</span>
        <h2 id="profile-editor-title">Make {profile.name} yours</h2>
        <p>Enter any emoji and choose an accent that is easy to spot.</p>
      </div>
      <div className="profile-editor-preview">
        <Avatar emoji={selectedEmoji} size={72}/>
        <span><strong>{name || profile.name}</strong><small>{profile.description}</small></span>
      </div>
      <label className="field-label">Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={24}/></label>
      <label className="field-label">Emoji<input className="emoji-input" value={emoji} onChange={(event) => setEmoji(event.target.value)} onBlur={() => setEmoji(selectedEmoji)} placeholder="Type or paste an emoji" autoComplete="off"/><small>Use your keyboard’s emoji picker, or paste any emoji.</small></label>
      <div className="field-label">Accent color<div className="accent-options">{accents.map((color) => <button key={color} style={{ background: color, color }} className={accent === color ? 'selected' : ''} onClick={() => setAccent(color)} aria-label={`Use ${color} accent`}>{accent === color && <Check size={14}/>}</button>)}</div></div>
      <div className="profile-editor-footer"><button className="secondary-button" onClick={reset}><RotateCcw size={16}/> Reset</button><button className="primary-button" onClick={() => onSave({ ...profile, name: name.trim() || profile.name, accent, avatar: selectedEmoji })}>Save profile</button></div>
    </section>
  </div>
}
