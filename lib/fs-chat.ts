import { promises as fs } from "fs"
import path from "path"

export type StoredMessage = {
  id: string
  seq?: number // 添加序列号字段，用于局部刷新
  user: { nickname: string; qq: string }
  text?: string
  imagePaths?: string[] | null
  createdAt: number
}

export type LoadedMessage = StoredMessage & { revoked?: boolean; reactions?: { emoji: string; count: number }[] }

const FILE_CAP = 100
const PREFIX = "chat_"
const REV_FILE = "revoked.json"
const REACT_FILE = "reactions.json"

export function baseDir() {
  // On Vercel, only /tmp is writable. Locally, write to ./chat
  if (process.env.VERCEL || process.env.NOW_REGION) return "/tmp/chat"
  return path.join(process.cwd(), "chat")
}

function picDir() {
  return path.join(baseDir(), "pic")
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function fileNameForIndex(idx: number) {
  const pad = String(idx).padStart(2, "0")
  return `${PREFIX}${pad}.json`
}

async function listChatFiles(dir: string) {
  try {
    const names = await fs.readdir(dir)
    return names
      .filter((n) => n.startsWith(PREFIX) && n.endsWith(".json"))
      .map((n) => {
        const num = Number(n.slice(PREFIX.length, n.length - 5))
        return { name: n, index: Number.isFinite(num) ? num : -1 }
      })
      .filter((x) => x.index > 0)
      .sort((a, b) => a.index - b.index)
  } catch {
    return []
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(filePath, "utf8")
    return JSON.parse(buf) as T
  } catch {
    return fallback
  }
}

async function writeJsonAtomic(filePath: string, data: unknown) {
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data))
  await fs.rename(tmp, filePath)
}

// Function to save image without conversion
export async function saveImage(buffer: Buffer, qq: string, index: number, extension: string): Promise<string> {
  const dir = picDir()
  await ensureDir(dir)
  
  const filename = `${qq}_${index}.${extension}`
  const filepath = path.join(dir, filename)
  
  // Save image as-is
  await fs.writeFile(filepath, buffer)
  
  return filename
}

// Function to clean up old files (older than 2 days)
export async function cleanupOldFiles() {
  const dir = baseDir()
  const picDirPath = picDir()
  
  try {
    // Clean up chat json files
    const chatFiles = await listChatFiles(dir)
    for (const file of chatFiles) {
      const filePath = path.join(dir, file.name)
      try {
        const stats = await fs.stat(filePath)
        const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000)
        
        if (stats.mtime.getTime() < twoDaysAgo) {
          await fs.unlink(filePath)
        }
      } catch {
        // File may have been deleted already
      }
    }
    
    // Clean up revoked and reactions files if older than 2 days
    const metaFiles = [REV_FILE, REACT_FILE]
    for (const metaFile of metaFiles) {
      const filePath = path.join(dir, metaFile)
      try {
        const stats = await fs.stat(filePath)
        const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000)
        
        if (stats.mtime.getTime() < twoDaysAgo) {
          await fs.unlink(filePath)
        }
      } catch {
        // File may not exist, ignore
      }
    }
    
    // Clean up image files
    try {
      const imageFiles = await fs.readdir(picDirPath)
      for (const imageFile of imageFiles) {
        const filePath = path.join(picDirPath, imageFile)
        try {
          const stats = await fs.stat(filePath)
          const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000)
          
          if (stats.mtime.getTime() < twoDaysAgo) {
            await fs.unlink(filePath)
          }
        } catch {
          // File may have been deleted already
        }
      }
    } catch {
      // Pic directory may not exist, ignore
    }
  } catch (error) {
    console.error("Error during cleanup:", error)
  }
}

export async function appendMessage(msg: StoredMessage) {
  const dir = baseDir()
  await ensureDir(dir)
  const files = await listChatFiles(dir)
  
  // 获取最新的序列号
  let latestSeq = 0
  for (let i = Math.max(0, files.length - 10); i < files.length; i++) {
    const f = files[i]
    const arr = await readJson<StoredMessage[]>(path.join(dir, f.name), [])
    for (const m of arr) {
      if (m.seq && m.seq > latestSeq) {
        latestSeq = m.seq
      }
    }
  }
  
  // 为新消息分配序列号
  const newMsg = { ...msg, seq: latestSeq + 1 }
  
  if (files.length === 0) {
    const newPath = path.join(dir, fileNameForIndex(1))
    await writeJsonAtomic(newPath, [newMsg])
    return
  }

  const last = files[files.length - 1]
  const lastPath = path.join(dir, last.name)
  const arr = await readJson<StoredMessage[]>(lastPath, [])
  if (arr.length >= FILE_CAP) {
    const newPath = path.join(dir, fileNameForIndex(last.index + 1))
    await writeJsonAtomic(newPath, [newMsg])
  } else {
    arr.push(newMsg)
    await writeJsonAtomic(lastPath, arr)
  }
}

async function getRevokedSet(dir: string) {
  const revoked = await readJson<string[]>(path.join(dir, REV_FILE), [])
  return new Set(revoked)
}

type ReactionMap = Record<string, Record<string, string[]>> // messageId -> emoji -> [userKey]

async function readReactions(dir: string): Promise<ReactionMap> {
  return await readJson<ReactionMap>(path.join(dir, REACT_FILE), {})
}

async function writeReactions(dir: string, obj: ReactionMap) {
  await writeJsonAtomic(path.join(dir, REACT_FILE), obj)
}

export async function toggleReaction(messageId: string, emoji: string, userKey: string) {
  const dir = baseDir()
  await ensureDir(dir)
  const all = await readReactions(dir)
  if (!all[messageId]) all[messageId] = {}
  if (!all[messageId][emoji]) all[messageId][emoji] = []
  const arr = all[messageId][emoji]
  const idx = arr.indexOf(userKey)
  if (idx === -1) arr.push(userKey)
  else arr.splice(idx, 1)
  // cleanup
  if (all[messageId][emoji].length === 0) delete all[messageId][emoji]
  if (Object.keys(all[messageId]).length === 0) delete all[messageId]
  await writeReactions(dir, all)
  return true
}

export async function loadMessages(limit = 200): Promise<LoadedMessage[]> {
  const dir = baseDir()
  await ensureDir(dir)
  const files = await listChatFiles(dir)
  const messages: StoredMessage[] = []
  for (let i = Math.max(0, files.length - 10); i < files.length; i++) {
    const f = files[i]
    const arr = await readJson<StoredMessage[]>(path.join(dir, f.name), [])
    messages.push(...arr)
  }
  const revoked = await getRevokedSet(dir)
  const reactions = await readReactions(dir)
  const sliced = messages.slice(-limit)
  return sliced.map<LoadedMessage>((m) => {
    const map = reactions[m.id] || {}
    const reactionArr = Object.entries(map)
      .map(([emoji, users]) => ({ emoji, count: users.length }))
      .sort((a, b) => b.count - a.count)
    return { ...m, revoked: revoked.has(m.id), reactions: reactionArr }
  })
}

export async function revokeMessageId(id: string) {
  const dir = baseDir()
  await ensureDir(dir)
  const file = path.join(dir, REV_FILE)
  const arr = await readJson<string[]>(file, [])
  if (!arr.includes(id)) {
    arr.push(id)
    await writeJsonAtomic(file, arr)
  }
  return true
}