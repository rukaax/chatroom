import { type NextRequest, NextResponse } from "next/server"
import { loadMessages, revokeMessageId } from "@/lib/fs-chat"

function badRequest(msg: string, code = 400) {
  return new NextResponse(msg, { status: code })
}

export async function POST(req: NextRequest) {
  const { id, nickname, qq } = await req.json().catch(() => ({}))
  if (!id) return badRequest("缺少消息 ID")
  if (!nickname || !/^[0-9]{5,15}$/.test(String(qq ?? ""))) return badRequest("身份信息无效")

  // Ensure requester owns the message
  const list = await loadMessages(500)
  const target = list.find((m) => m.id === id)
  if (!target) return badRequest("消息不存在", 404)
  if (target.user.nickname !== nickname || target.user.qq !== String(qq)) {
    return badRequest("仅发送者可撤回", 403)
  }

  await revokeMessageId(id)
  const messages = await loadMessages(200)
  return NextResponse.json(messages)
}
