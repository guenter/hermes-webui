import type { Conversation, SessionFilter } from './types'

export function matchesSessionFilter(conversation: Conversation, filter: SessionFilter) {
  if (filter === 'all') return true
  return filter === 'cron' ? conversation.source === 'cron' : conversation.source !== 'cron'
}
