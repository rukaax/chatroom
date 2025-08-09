import { type NextRequest } from "next/server"
import { baseDir } from "@/lib/fs-chat"

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    // Get the filename from the URL
    const filename = params.slug?.join("/")
    if (!filename) {
      return new Response("File not found", { status: 404 })
    }

    // Security check - ensure the file is in the pic directory and has valid image extension
    if (!filename.match(/^[0-9]+_[0-9]+\.(jpe?g|png|gif|webp|svg)$/i)) {
      return new Response("Invalid file name", { status: 400 })
    }

    // 动态导入模块以避免构建时问题
    const path = await import("path")
    const fs = await import("fs/promises")
    
    // Construct the full file path using the same baseDir function used in message route
    let filePath = path.join(baseDir(), "pic", filename)

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      // 在Vercel环境中尝试另一种路径
      const vercelPath = path.join("/tmp/chat", "pic", filename);
      try {
        await fs.access(vercelPath);
        // 如果文件在Vercel路径中存在，则使用该路径
        filePath = vercelPath;
      } catch {
        return new Response("File not found", { status: 404 })
      }
    }
    
    // Read file
    const fileBuffer = await fs.readFile(filePath)
    
    // Determine content type based on file extension
    let contentType = "image/jpeg";
    if (filename.endsWith(".png")) {
      contentType = "image/png";
    } else if (filename.endsWith(".gif")) {
      contentType = "image/gif";
    } else if (filename.endsWith(".webp")) {
      contentType = "image/webp";
    } else if (filename.endsWith(".svg")) {
      contentType = "image/svg+xml";
    } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    }

    // Return the response with appropriate headers
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable", // 1 year cache
      },
    })
  } catch (error) {
    console.error("Error serving image:", error)
    return new Response("File not found", { status: 404 })
  }
}