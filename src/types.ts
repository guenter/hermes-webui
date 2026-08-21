export type ProfileId = string
export type ConversationId = string
export type SessionFilter = 'all' | 'user' | 'cron'

export type HermesProfile = {
  id: ProfileId
  name: string
  description: string
  model: string
  accent: string
  avatar: string
}

export type RunState =
  | 'idle'
  | 'connecting'
  | 'queued'
  | 'streaming'
  | 'awaiting_input'
  | 'interrupting'
  | 'completed'
  | 'failed'

export type ToolExecution = {
  id: string
  name: string
  label: string
  input?: unknown
  output?: unknown
  status: 'running' | 'complete' | 'failed'
  duration?: string
}

export type MessageBlock =
  | { type: 'markdown'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; tool: ToolExecution }
  | { type: 'notice'; tone: 'info' | 'warning' | 'error'; text: string }

export type ConversationMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  blocks: MessageBlock[]
  createdAt: number
}

export type InteractiveRequest = {
  id: string
  kind: 'approval' | 'clarify' | 'sudo' | 'secret'
  title: string
  description: string
  options?: string[]
}

export type Conversation = {
  id: ConversationId
  profileId: ProfileId
  title: string
  preview: string
  updatedAt: number
  source: 'web' | 'tui' | 'telegram' | 'cron'
  model: string
  unread: boolean
  runState: RunState
  messages: ConversationMessage[]
  request?: InteractiveRequest
}

export type GatewayEvent = {
  method?: string
  type?: string
  params?: Record<string, unknown>
  payload?: Record<string, unknown>
  [key: string]: unknown
}

export interface HermesClient {
  listProfiles(): Promise<HermesProfile[]>
  listConversations(profile?: ProfileId): Promise<Conversation[]>
  getHistory(profile: ProfileId, conversationId: ConversationId): Promise<ConversationMessage[]>
  createConversation(profile: ProfileId): Promise<Conversation>
  submit(profile: ProfileId, conversationId: ConversationId, text: string): Promise<void>
  interrupt(profile: ProfileId, conversationId: ConversationId): Promise<void>
  steer(profile: ProfileId, conversationId: ConversationId, text: string): Promise<void>
  respond(profile: ProfileId, conversationId: ConversationId, request: InteractiveRequest, value: string): Promise<void>
  attachFile(profile: ProfileId, conversationId: ConversationId, file: { name: string; dataUrl: string }): Promise<{ name: string; refText: string }>
  subscribe(listener: (event: GatewayEvent) => void): () => void
}
