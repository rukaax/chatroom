"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Send, ImageIcon, X, SmilePlus } from "lucide-react"

type ReactionChip = { emoji: string; count: number }

type ChatMessage = {
  id: string
  user: {
    nickname: string
    qq: string
  }
  text?: string
  imageDataUrls?: string[] | null
  createdAt: number
  revoked?: boolean
  reactions?: ReactionChip[]
}

type Identity = { nickname: string; qq: string }

const EMOJIS = [
  "😀",
  "😂",
  "😊",
  "😍",
  "😎",
  "😭",
  "😡",
  "👍",
  "🙏",
  "🎉",
  "🔥",
  "🌟",
  "❤️",
  "🥰",
  "🤔",
  "🙌",
  "😴",
  "🤩",
  "🤗",
  "👏",
  "😁",
  "😉",
  "😢",
  "😱",
  "👌",
  "💪",
  "🫶",
  "💯",
  "✨",
]

function getAvatarUrl(qq: string) {
  return `https://q.qlogo.cn/headimg_dl?dst_uin=${encodeURIComponent(qq)}&spec=640&img_type=jpg`
}

export function Chat() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [nickInput, setNickInput] = useState("")
  const [qqInput, setQqInput] = useState("")

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Mobile long-press state
  const [quickReactFor, setQuickReactFor] = useState<string | null>(null)
  const longPressTimer = useRef<number | null>(null)

  useEffect(() => {
    try {
      const s = localStorage.getItem("chat_identity")
      if (s) setIdentity(JSON.parse(s))
    } catch {}
  }, [])

  // Poll messages
  useEffect(() => {
    let mounted = true
    async function fetchMessages() {
      try {
        const res = await fetch("/api/messages", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as ChatMessage[]
        if (mounted) setMessages(data)
      } catch {}
    }
    fetchMessages()
    const t = setInterval(fetchMessages, 1200)
    return () => {
      mounted = false
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  // Image previews
  useEffect(() => {
    previews.forEach((p) => URL.revokeObjectURL(p))
    const next = files.map((f) => URL.createObjectURL(f))
    setPreviews(next)
    return () => next.forEach((p) => URL.revokeObjectURL(p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => `${f.name}-${f.size}-${f.lastModified}`).join("|")])

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        day: "2-digit",
      }),
    [],
  )

  function saveIdentity() {
    const nickname = nickInput.trim()
    const qq = qqInput.trim()
    if (!nickname) return alert("请输入昵称")
    if (!/^[0-9]{5,15}$/.test(qq)) return alert("请输入有效的 QQ 号（5-15 位数字）")
    const id = { nickname, qq }
    setIdentity(id)
    try {
      localStorage.setItem("chat_identity", JSON.stringify(id))
    } catch {}
  }

  // Add files with validation (multi / drag / paste)
  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const maxSize = 3 * 1024 * 1024
      const list = Array.from(incoming)
      const imgs = list.filter((f) => /^image\/.+/.test(f.type))
      if (imgs.length !== list.length) {
        alert("仅支持图片文件")
      }
      const oversized = imgs.find((f) => f.size > maxSize)
      if (oversized) {
        alert("存在超过 3MB 的图片，请压缩后再上传")
        return
      }
      const MAX_IMAGES = 6
      const merged = [...files, ...imgs].slice(0, MAX_IMAGES)
      setFiles(merged)
    },
    [files],
  )

  // DnD handlers
  useEffect(() => {
    const dropZone = dropRef.current
    if (!dropZone) return
    function onDragOver(e: DragEvent) {
      e.preventDefault()
      setIsDragOver(true)
    }
    function onDragLeave(e: DragEvent) {
      if (e.target === dropZone) setIsDragOver(false)
    }
    function onDrop(e: DragEvent) {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer?.files?.length) {
        addFiles(e.dataTransfer.files)
      }
    }
    dropZone.addEventListener("dragover", onDragOver)
    dropZone.addEventListener("dragleave", onDragLeave)
    dropZone.addEventListener("drop", onDrop)
    return () => {
      dropZone.removeEventListener("dragover", onDragOver)
      dropZone.removeEventListener("dragleave", onDragLeave)
      dropZone.removeEventListener("drop", onDrop)
    }
  }, [addFiles])

  // Paste images
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const files = e.clipboardData?.files
    if (files && files.length) {
      addFiles(files)
    }
  }

  async function onSend() {
    if (!identity) return
    const value = text.trim()
    if (!value && files.length === 0) return

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.set("nickname", identity.nickname)
      formData.set("qq", identity.qq)
      if (value) formData.set("text", value)
      for (const f of files) formData.append("images", f)

      const res = await fetch("/api/messages", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.text().catch(() => "")
        alert(err || "发送失败")
        return
      }
      setText("")
      setFiles([])
      const latest = await fetch("/api/messages", { cache: "no-store" })
      if (latest.ok) setMessages(await latest.json())
    } finally {
      setIsSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && (text.trim().length > 0 || files.length > 0)) {
      e.preventDefault()
      onSend()
    }
  }

  function getIsOwner(m: ChatMessage) {
    return identity?.qq === m.user.qq && identity?.nickname === m.user.nickname
  }

  async function revokeMessage(id: string) {
    if (!identity) return
    const res = await fetch("/api/messages/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, nickname: identity.nickname, qq: identity.qq }),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      alert(msg || "撤回失败")
      return
    }
    const latest = await fetch("/api/messages", { cache: "no-store" })
    if (latest.ok) setMessages(await latest.json())
  }

  async function copyText(t?: string) {
    try {
      await navigator.clipboard.writeText(t || "")
    } catch {
      alert("复制失败")
    }
  }

  async function copyImage(dataUrl?: string) {
    if (!dataUrl) return
    try {
      if ("clipboard" in navigator && "write" in navigator.clipboard && (window as any).ClipboardItem) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        await (navigator as any).clipboard.write([new (window as any).ClipboardItem({ [blob.type]: blob })])
      } else {
        window.open(dataUrl, "_blank", "noopener,noreferrer")
      }
    } catch {
      window.open(dataUrl, "_blank", "noopener,noreferrer")
    }
  }

  async function reactToMessage(id: string, emoji: string) {
    if (!identity) return
    try {
      const res = await fetch("/api/messages/react", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, emoji, nickname: identity.nickname, qq: identity.qq }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => "")
        alert(msg || "表情回复失败")
        return
      }
      const latest = await fetch("/api/messages", { cache: "no-store" })
      if (latest.ok) setMessages(await latest.json())
    } catch {
      // no-op
    } finally {
      // close quick reaction bar after reacting
      setQuickReactFor((cur) => (cur === id ? null : cur))
    }
  }

  // Long-press helpers
  function startLongPress(id: string) {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
    // 1s long press
    longPressTimer.current = window.setTimeout(() => {
      setQuickReactFor(id)
    }, 1000)
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  return (
    <Card className="border-white/50 bg-white/65 backdrop-blur-md text-slate-900 shadow-xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/60">
        <CardTitle className="text-slate-900">公共房间</CardTitle>
        {identity && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAvatarUrl(identity.qq) || "/placeholder.svg"}
              alt="我的 QQ 头像"
              className="h-8 w-8 rounded-full border border-white/70 object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="text-sm text-slate-700">
              {identity.nickname} | {identity.qq}
            </div>
          </div>
        )}
      </CardHeader>

      {!identity ? (
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nickname" className="text-slate-700">
                昵称
              </Label>
              <Input
                id="nickname"
                placeholder="输入你的昵称"
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                className="bg-white/90 border-slate-300 text-slate-900 placeholder:text-slate-500"
                maxLength={20}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qq" className="text-slate-700">
                QQ号
              </Label>
              <Input
                id="qq"
                placeholder="输入你的 QQ 号（仅数字）"
                value={qqInput}
                onChange={(e) => setQqInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="bg-white/90 border-slate-300 text-slate-900 placeholder:text-slate-500"
                inputMode="numeric"
                maxLength={15}
              />
              <p className="text-xs text-slate-600">
                头像来自：{"https://q.qlogo.cn/headimg_dl?dst_uin=QQ_ID&spec=640&img_type=jpg"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button onClick={saveIdentity} className="w-full bg-emerald-600 text-white hover:bg-emerald-500">
                进入聊天室
              </Button>
            </div>
          </div>
        </CardContent>
      ) : (
        <>
          <CardContent className="p-0">
            <div
              ref={listRef}
              className="h-[68vh] md:h-[62vh] w-full overflow-y-auto p-3 sm:p-4 space-y-4 [scrollbar-width:thin]"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="h-full grid place-items-center text-slate-700 text-sm">
                  还没有消息，快来发送第一条吧～
                </div>
              ) : (
                messages.map((m) => {
                  const onTouchStart = () => startLongPress(m.id)
                  const onTouchEnd = () => cancelLongPress()
                  const onTouchMove = () => cancelLongPress()

                  const bubble = (
                    <div
                      className="min-w-0 flex-1"
                      onTouchStart={onTouchStart}
                      onTouchEnd={onTouchEnd}
                      onTouchMove={onTouchMove}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-900">
                          {m.user.nickname} | {m.user.qq}
                        </span>
                        <span>{timeFmt.format(new Date(m.createdAt))}</span>
                      </div>
                      {m.revoked ? (
                        <div className="mt-1 inline-block rounded-md bg-slate-200/70 px-2 py-1 text-xs text-slate-600">
                          消息已撤回
                        </div>
                      ) : (
                        <>
                          {m.text && (
                            <div className="mt-1 inline-block max-w-[92%] md:max-w-[80%] rounded-2xl bg-white px-3 py-2 shadow-sm">
                              <p className="whitespace-pre-wrap break-words text-slate-900">{m.text}</p>
                            </div>
                          )}
                          {m.imageDataUrls && m.imageDataUrls.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-[92%] md:max-w-[80%]">
                              {m.imageDataUrls.map((src, idx) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={idx}
                                  src={src || "/placeholder.svg"}
                                  alt="用户上传的图片"
                                  className="max-h-64 w-full rounded-xl border border-white/70 object-cover shadow"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          )}

                          {/* Reaction chips */}
                          {m.reactions && m.reactions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {m.reactions.map((r) => (
                                <button
                                  key={m.id + r.emoji}
                                  type="button"
                                  onClick={() => reactToMessage(m.id, r.emoji)}
                                  className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-sm shadow border border-slate-300 hover:bg-white"
                                  title="点击切换表情回复"
                                >
                                  <span>{r.emoji}</span>
                                  <span className="text-slate-700">{r.count}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Inline quick reaction bar for mobile long-press */}
                          {quickReactFor === m.id && (
                            <div className="mt-2 grid grid-cols-8 gap-1 bg-white/90 border border-slate-300 rounded-lg p-2 w-max shadow">
                              {EMOJIS.slice(0, 24).map((e) => (
                                <button
                                  key={e}
                                  className="text-xl hover:bg-slate-100 rounded"
                                  onClick={() => reactToMessage(m.id, e)}
                                  aria-label={`回复 ${e}`}
                                >
                                  {e}
                                </button>
                              ))}
                              <button
                                className="col-span-8 mt-1 text-xs text-slate-600 underline"
                                onClick={() => setQuickReactFor(null)}
                              >
                                关闭
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )

                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAvatarUrl(m.user.qq) || "/placeholder.svg"}
                        alt={`${m.user.nickname} 的 QQ 头像`}
                        className="h-9 w-9 rounded-full border border-white/70 object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <ContextMenu>
                        <ContextMenuTrigger className="flex-1" onContextMenu={() => setQuickReactFor(null)}>
                          {bubble}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56">
                          {m.text && <ContextMenuItem onClick={() => copyText(m.text)}>复制文本</ContextMenuItem>}
                          {m.imageDataUrls && m.imageDataUrls.length > 0 && (
                            <ContextMenuItem onClick={() => copyImage(m.imageDataUrls![0])}>复制图片</ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          <div className="px-2 py-1 text-xs text-slate-500">表情回复</div>
                          <div className="grid grid-cols-8 gap-1 px-2 pb-2">
                            {EMOJIS.slice(0, 24).map((e) => (
                              <button
                                key={e}
                                className="text-lg hover:bg-slate-100 rounded"
                                onClick={() => reactToMessage(m.id, e)}
                                title={`回复 ${e}`}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                          <ContextMenuSeparator />
                          {getIsOwner(m) ? (
                            <ContextMenuItem onClick={() => revokeMessage(m.id)} className="text-red-600">
                              撤回
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem disabled>仅发送者可撤回</ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>

          <CardFooter className="border-t border-white/60 p-3">
            <div ref={dropRef} className="flex w-full flex-col gap-3">
              {previews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src || "/placeholder.svg"}
                        alt={`预览 ${idx + 1}`}
                        className="h-20 w-full rounded-md object-cover border border-white/70"
                      />
                      <button
                        aria-label="移除图片"
                        className="absolute -top-2 -right-2 rounded-full bg-white text-slate-800 shadow border border-slate-300"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className={`flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-lg border ${
                  isDragOver ? "border-emerald-400 bg-emerald-50/70" : "border-slate-300 bg-white/90"
                } p-2`}
              >
                <label
                  htmlFor="image-upload"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-white/90 cursor-pointer"
                >
                  <ImageIcon className="h-4 w-4" />
                  图片
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = e.target.files
                    if (!list || list.length === 0) return
                    addFiles(list)
                    e.currentTarget.value = ""
                  }}
                />

                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="border-slate-300 text-slate-800 bg-white">
                      <SmilePlus className="h-4 w-4 mr-2" />
                      表情
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 grid grid-cols-8 gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        className="text-xl hover:bg-slate-100 rounded"
                        onClick={() => setText((t) => t + e)}
                        type="button"
                        aria-label={`插入 ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  onPaste={onPaste}
                  placeholder="输入消息，按回车发送（支持多图/拖拽/粘贴）"
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 flex-1"
                  maxLength={500}
                  aria-label="消息输入框"
                />
                <Button
                  onClick={onSend}
                  disabled={isSending || (text.trim().length === 0 && files.length === 0)}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  type="button"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-slate-600">
                支持多图/拖拽/粘贴，单张 ≤ 3MB；移动端长按 1 秒或电脑右键可复制、撤回或添加表情回复。
              </p>
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
