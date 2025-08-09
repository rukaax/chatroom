export type ChatMessage = {
  id: string
  user: {
    nickname: string
    qq: string
  }
  text?: string
  imageDataUrls?: string[] | null
  createdAt: number
  revoked?: boolean
}

// Deprecated in favor of lib/fs-chat.ts (disk-based)
// Keeping the file for compatibility with prior imports.
const _noop: ChatMessage[] = []
export function getMessages(): ChatMessage[] {
  return _noop
}
export function addMessage(_: ChatMessage) {
  return
}
