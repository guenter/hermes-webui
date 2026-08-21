import { create } from 'zustand'
import { createId } from './id'
import type { Conversation, ConversationId, HermesProfile, MessageBlock, ProfileId, RunState, SessionFilter, ToolExecution } from './types'

type AppState = {
  profiles: HermesProfile[]
  conversations: Conversation[]
  activeConversationId: ConversationId
  profileFilter: ProfileId | 'all'
  sessionFilter: SessionFilter
  search: string
  railOpen: boolean
  commandOpen: boolean
  avatarOpen: boolean
  setProfiles: (profiles: HermesProfile[]) => void
  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: ConversationId) => void
  setProfileFilter: (id: ProfileId | 'all') => void
  setSessionFilter: (filter: SessionFilter) => void
  setSearch: (value: string) => void
  setRailOpen: (value: boolean) => void
  setCommandOpen: (value: boolean) => void
  setAvatarOpen: (value: boolean) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: ConversationId, patch: Partial<Conversation>) => void
  updateProfile: (id: ProfileId, patch: Partial<HermesProfile>) => void
  appendAssistantText: (id: ConversationId, text: string) => void
  appendNotice: (id: ConversationId, tone: Extract<MessageBlock, { type: 'notice' }>['tone'], text: string) => void
  upsertTool: (id: ConversationId, tool: ToolExecution) => void
  setRunState: (id: ConversationId, runState: RunState) => void
}

export const useAppStore = create<AppState>((set) => ({
  profiles: [],
  conversations: [],
  activeConversationId: '',
  profileFilter: 'all',
  sessionFilter: 'all',
  search: '',
  railOpen: false,
  commandOpen: false,
  avatarOpen: false,
  setProfiles: (profiles) => set({ profiles }),
  setConversations: (conversations) => set({ conversations, activeConversationId: conversations[0]?.id ?? '' }),
  setActiveConversation: (activeConversationId) => set((state) => ({
    activeConversationId,
    railOpen: false,
    conversations: state.conversations.map((conversation) => conversation.id === activeConversationId ? { ...conversation, unread: false } : conversation),
  })),
  setProfileFilter: (profileFilter) => set({ profileFilter }),
  setSessionFilter: (sessionFilter) => set({ sessionFilter }),
  setSearch: (search) => set({ search }),
  setRailOpen: (railOpen) => set({ railOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setAvatarOpen: (avatarOpen) => set({ avatarOpen }),
  addConversation: (conversation) => set((state) => ({ conversations: [conversation, ...state.conversations], activeConversationId: conversation.id })),
  updateConversation: (id, patch) => set((state) => ({ conversations: state.conversations.map((conversation) => conversation.id === id ? { ...conversation, ...patch } : conversation) })),
  updateProfile: (id, patch) => set((state) => ({ profiles: state.profiles.map((profile) => profile.id === id ? { ...profile, ...patch } : profile) })),
  appendAssistantText: (id, text) => set((state) => ({
    conversations: state.conversations.map((conversation) => {
      if (conversation.id !== id) return conversation
      const messages = [...conversation.messages]
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && last.blocks[last.blocks.length - 1]?.type === 'markdown') {
        const blocks = [...last.blocks]
        const block = blocks[blocks.length - 1]
        if (block.type === 'markdown') blocks[blocks.length - 1] = { ...block, text: block.text + text }
        messages[messages.length - 1] = { ...last, blocks }
      } else {
        messages.push({ id: createId(), role: 'assistant', createdAt: Date.now(), blocks: [{ type: 'markdown', text }] })
      }
      return { ...conversation, messages, preview: text.slice(0, 90), updatedAt: Date.now() }
    }),
  })),
  appendNotice: (id, tone, text) => set((state) => ({
    conversations: state.conversations.map((conversation) => {
      if (conversation.id !== id) return conversation
      const messages = [...conversation.messages]
      const last = messages.at(-1)
      const block: MessageBlock = { type: 'notice', tone, text }
      if (last?.role === 'assistant') messages[messages.length - 1] = { ...last, blocks: [...last.blocks, block] }
      else messages.push({ id: createId(), role: 'assistant', createdAt: Date.now(), blocks: [block] })
      return { ...conversation, messages, preview: text.slice(0, 90), updatedAt: Date.now() }
    }),
  })),
  upsertTool: (id, tool) => set((state) => ({
    conversations: state.conversations.map((conversation) => {
      if (conversation.id !== id) return conversation
      const messages = [...conversation.messages]
      const last = messages.at(-1)
      const assistant = last?.role === 'assistant'
        ? { ...last, blocks: [...last.blocks] }
        : { id: createId(), role: 'assistant' as const, createdAt: Date.now(), blocks: [] }
      const match = assistant.blocks.findIndex((block) => block.type === 'tool' && block.tool.id === tool.id)
      if (match >= 0) {
        const current = assistant.blocks[match]
        if (current.type === 'tool') assistant.blocks[match] = { type: 'tool', tool: {
          ...current.tool,
          ...tool,
          input: tool.input ?? current.tool.input,
          output: tool.output ?? current.tool.output,
        } }
      } else {
        assistant.blocks.push({ type: 'tool', tool })
      }
      if (last?.role === 'assistant') messages[messages.length - 1] = assistant
      else messages.push(assistant)
      return { ...conversation, messages, updatedAt: Date.now() }
    }),
  })),
  setRunState: (id, runState) => set((state) => ({ conversations: state.conversations.map((conversation) => conversation.id === id ? { ...conversation, runState } : conversation) })),
}))
