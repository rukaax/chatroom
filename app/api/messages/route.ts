import { type NextRequest, NextResponse } from "next/server"
import { appendMessage, loadMessages, type StoredMessage } from "@/lib/fs-chat"
import { Buffer } from "node:buffer"

function badRequest(msg: string, code = 400) {
  return new NextResponse(msg, { status: code })
}

async function fileToDataUrl(file: File) {
  const buf = Buffer.from(await file.arrayBuffer())
  const mime = file.type || "application/octet-stream"
  return `data:${mime};base64,${buf.toString("base64")}`
}

async function parseBody(req: NextRequest) {
  const ct = req.headers.get("content-type") || ""
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData()
    const nickname = String(fd.get("nickname") ?? "").trim()
    const qq = String(fd.get("qq") ?? "").trim()
    const text = (fd.get("text") ? String(fd.get("text")) : "").trim()
    const files = fd.getAll("images").filter((f): f is File => f instanceof File)
    return { nickname, qq, text, files }
  }
  if (ct.includes("application/json")) {
    const json = await req.json().catch(() => ({}))
    return {
      nickname: String(json.nickname ?? "").trim(),
      qq: String(json.qq ?? "").trim(),
      text: String(json.text ?? "").trim(),
      files: [] as File[],
    }
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const txt = await req.text()
    const params = new URLSearchParams(txt)
    return {
      nickname: String(params.get("nickname") ?? "").trim(),
      qq: String(params.get("qq") ?? "").trim(),
      text: String(params.get("text") ?? "").trim(),
      files: [] as File[],
    }
  }
  // Fallback try formdata
  try {
    const fd = await req.formData()
    const nickname = String(fd.get("nickname") ?? "").trim()
    const qq = String(fd.get("qq") ?? "").trim()
    const text = (fd.get("text") ? String(fd.get("text")) : "").trim()
    const files = fd.getAll("images").filter((f): f is File => f instanceof File)
    return { nickname, qq, text, files }
  } catch {
    return { nickname: "", qq: "", text: "", files: [] as File[] }
  }
}

export async function GET() {
  const messages = await loadMessages(200)
  return NextResponse.json(messages, { headers: { "cache-control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const { nickname, qq, text, files } = await parseBody(req)

  if (!nickname) return badRequest("缺少昵称")
  if (!/^[0-9]{5,15}$/.test(qq)) return badRequest("QQ 号无效")
  if (!text && (!files || files.length === 0)) return badRequest("消息内容为空")

  // Validate images
  const MAX_IMG = 6
  const MAX_SIZE = 3 * 1024 * 1024
  const images = (files || []).slice(0, MAX_IMG)

  for (const f of images) {
    if (!/^image\/.+/.test(f.type)) return badRequest("仅支持图片文件")
    if (f.size > MAX_SIZE) return badRequest("图片大于 3MB")
  }

  const imageDataUrls: string[] = []
  for (const f of images) {
    imageDataUrls.push(await fileToDataUrl(f))
  }

  const msg: StoredMessage = {
    id: crypto.randomUUID(),
    user: { nickname, qq },
    text: text || undefined,
    imageDataUrls: imageDataUrls.length > 0 ? imageDataUrls : undefined,
    createdAt: Date.now(),
  }

  await appendMessage(msg)
  const messages = await loadMessages(200)
  return NextResponse.json(messages)
}
