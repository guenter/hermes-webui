import { AlertTriangle, Check, KeyRound, MessageCircleQuestion, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { InteractiveRequest } from '../types'

const icons = { approval: ShieldCheck, clarify: MessageCircleQuestion, sudo: AlertTriangle, secret: KeyRound }
const optionLabel: Record<string, string> = { once: 'Allow once', session: 'Allow for this session', always: 'Always allow', deny: 'Deny' }

export function InteractiveCard({ request, onRespond }: { request: InteractiveRequest; onRespond: (value: string) => void }) {
  const Icon = icons[request.kind]
  const [value, setValue] = useState('')
  return <div className={`interactive-card ${request.kind}`}><div className="interactive-icon"><Icon size={21}/></div><div className="interactive-copy"><div className="interactive-title">{request.title}</div><p>{request.description}</p>{request.kind === 'secret' || !request.options ? <div className="interactive-input"><input type={request.kind === 'secret' ? 'password' : 'text'} value={value} onChange={(event) => setValue(event.target.value)} placeholder={request.kind === 'secret' ? 'Enter securely' : 'Type your response'}/><button disabled={!value} onClick={() => { onRespond(value); setValue('') }}>Send</button></div> : <div className="interactive-options">{request.options.map((option, index) => <button key={option} className={index === 0 ? 'primary' : ''} onClick={() => onRespond(option)}>{index === 0 && <Check size={14}/>} {optionLabel[option] ?? option}</button>)}</div>}</div></div>
}
