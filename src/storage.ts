import Dexie, { type EntityTable } from 'dexie'
export type ProfilePresentation = {
  profileId: string
  displayName?: string
  accent: string
  avatar?: unknown
}

export type ConversationDraft = {
  conversationId: string
  text: string
  updatedAt: number
}

export type Preference = { key: string; value: string }

class HermesUiDatabase extends Dexie {
  profilePresentations!: EntityTable<ProfilePresentation, 'profileId'>
  conversationDrafts!: EntityTable<ConversationDraft, 'conversationId'>
  preferences!: EntityTable<Preference, 'key'>

  constructor() {
    // Keep the original database name so the plugin rename preserves user preferences.
    super('hermes-ui')
    this.version(1).stores({
      profilePresentations: 'profileId',
      conversationDrafts: 'conversationId, updatedAt',
      preferences: 'key',
    })
  }
}

export const db = new HermesUiDatabase()

export async function saveDraft(conversationId: string, text: string) {
  await db.conversationDrafts.put({ conversationId, text, updatedAt: Date.now() })
}

export async function loadDraft(conversationId: string) {
  return (await db.conversationDrafts.get(conversationId))?.text ?? ''
}
