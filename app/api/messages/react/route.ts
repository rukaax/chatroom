import { type NextRequest, NextResponse } from "next/server"
import { loadMessages, toggleReaction } from "@/lib/fs-chat"

function badRequest(msg: string, code = 400) {
  return new NextResponse(msg, { status: code })
}

export async function POST(req: NextRequest) {
  const { id, emoji, nickname, qq } = await req.json().catch(() => ({}))
  if (!id || !emoji) return badRequest("缺少参数")
  if (!nickname || !/^[0-9]{5,15}$/.test(String(qq ?? ""))) return badRequest("身份信息无效")

  const list = await loadMessages(500)
  const target = list.find((m) => m.id === id)
  if (!target) return badRequest("消息不存在", 404)

  const userKey = `${nickname}|${qq}`
  await toggleReaction(id, emoji, userKey)

  const messages = await loadMessages(200)
  return NextResponse.json(messages)
}
