import Image from "next/image"
import { Chat } from "@/components/chat"

export default function Page() {
  return (
    <main className="relative min-h-screen">
      {/* Scenic blue iceberg background without Gaussian blur (only chat card is blurred) */}
      <div className="absolute inset-0 -z-10">
        <Image src="/images/iceberg.png" alt="蓝色冰山风景背景" fill className="object-cover scale-105" priority />
        {/* Soft light overlay for readability while keeping the scene visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/20 to-white/40" />
      </div>

      <div className="container mx-auto px-4 py-8">
        <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">在线聊天室</h1>
          <p className="text-sm text-slate-700">输入昵称与 QQ 号即可加入（头像自动使用 QQ 头像）</p>
        </header>

        <Chat />

        <footer className="mt-6 text-center text-xs text-slate-700/80">
          消息以 JSON 文件存储在 /chat 目录（每 100 条分一个文件）。图片 ≤ 3MB/张。
        </footer>
      </div>
    </main>
  )
}
