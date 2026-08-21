import { Check, ChevronDown, ChevronRight, CircleAlert, Copy, Info, RotateCcw, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { tokenizeShell } from '../shell-syntax'
import { presentTool } from '../tool-presentation'
import type { ConversationMessage, HermesProfile, MessageBlock, ToolExecution } from '../types'
import { Avatar } from './Avatar'

function ToolCard({ tool }: { tool: ToolExecution }) {
  const [open, setOpen] = useState(false)
  const view = presentTool(tool)
  return <div className={`tool-card ${tool.status}`}>
    <button className="tool-heading" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="tool-icon">{view.emoji}</span><span className="tool-label">{view.title}</span>{view.summary && <span className="tool-summary">{view.summary}</span>}
      {tool.status === 'running' ? <span className="tool-running"><i/><i/><i/></span> : tool.status === 'complete' ? <Check size={15}/> : <CircleAlert size={15}/>}
      {tool.duration && <span className="tool-duration">{tool.duration}</span>}{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
    </button>
    {open && <div className="tool-body">{view.fields.length > 0 ? view.fields.map((item) => <div className="tool-field" key={item.label}><strong>{item.label}</strong>{item.kind === 'command' ? <ShellCommand value={item.value}/> : item.kind === 'code' ? <code>{item.value}</code> : item.kind === 'output' ? <pre>{item.value}</pre> : <p>{item.value}</p>}</div>) : <p className="tool-no-details">No additional details</p>}</div>}
  </div>
}

const noticeIcon = { info: Info, warning: TriangleAlert, error: CircleAlert }

function ShellCommand({ value }: { value: string }) {
  return <code className="syntax-command">{tokenizeShell(value).map((token, index) => token.kind === 'plain' ? token.text : <span className={`syntax-${token.kind}`} key={`${index}-${token.text}`}>{token.text}</span>)}</code>
}

function ToolGroup({ tools }: { tools: ToolExecution[] }) {
  const [open, setOpen] = useState(false)
  const running = tools.some((tool) => tool.status === 'running')
  const failed = tools.some((tool) => tool.status === 'failed')
  const previews = tools.slice(0, 4).map((tool) => presentTool(tool).emoji).join(' ')
  return <div className={`tool-group ${running ? 'running' : failed ? 'failed' : 'complete'}`}>
    <button className="tool-group-heading" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="tool-group-icons">{previews}</span>
      <span>{running ? 'Working' : `${tools.length} ${tools.length === 1 ? 'tool used' : 'tools used'}`}</span>
      {running && <span className="tool-running"><i/><i/><i/></span>}
      <small>{tools.map((tool) => presentTool(tool).title).join(' · ')}</small>
      {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
    </button>
    {open && <div className="tool-group-list">{tools.map((tool) => <ToolCard key={tool.id} tool={tool}/>)}</div>}
  </div>
}

function MessageActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return <div className="message-actions"><button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy'}</button><button><RotateCcw size={14}/> Retry</button></div>
}

export function Message({ message, profile }: { message: ConversationMessage; profile: HermesProfile }) {
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const text = message.blocks.filter((block) => block.type === 'markdown').map((block) => block.type === 'markdown' ? block.text : '').join('\n')
  if (message.role === 'user') return <article className="message user-message"><div className="user-bubble"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div></article>
  if (message.role === 'system') return <article className="system-message">{text}</article>
  return <article className="message assistant-message">
    <div className="message-avatar"><Avatar emoji={profile.avatar} size={34}/></div>
    <div className="message-content">
      <div className="assistant-name"><span>{profile.name}</span><small>{profile.model}</small></div>
      {renderBlocks(message.blocks, thinkingOpen, () => setThinkingOpen(!thinkingOpen))}
      {text && <MessageActions text={text}/>}
    </div>
  </article>
}

function renderBlocks(blocks: MessageBlock[], thinkingOpen: boolean, toggleThinking: () => void) {
  const rendered: ReactNode[] = []
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index]
    if (block.type === 'tool') {
      const tools: ToolExecution[] = []
      while (index < blocks.length && blocks[index].type === 'tool') {
        const toolBlock = blocks[index]
        if (toolBlock.type === 'tool') tools.push(toolBlock.tool)
        index += 1
      }
      rendered.push(<ToolGroup key={`tools-${tools[0].id}`} tools={tools}/>)
      continue
    }
    if (block.type === 'markdown') rendered.push(<div className="markdown" key={index}><ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown></div>)
    else if (block.type === 'thinking') rendered.push(<div className="thinking" key={index}><button onClick={toggleThinking}>{thinkingOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}<span>Thought process</span></button>{thinkingOpen && <p>{block.text}</p>}</div>)
    else {
      const Icon = noticeIcon[block.tone]
      rendered.push(<div className={`notice ${block.tone}`} key={index}><Icon size={16}/><div className="notice-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown></div></div>)
    }
    index += 1
  }
  return rendered
}
