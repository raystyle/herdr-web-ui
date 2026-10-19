// [v3 F2] 实例文件面(网关实例文件 API,网关域会话 cookie;origin 绝对
// URL 绕基址 fetch 补丁——同 desktop.ts 坑)。
const GATEWAY = window.location.origin

export interface InstanceFileEntry {
  path: string
  type: "f" | "d" | string
  size: number
  mtime: number
}

export async function listInstanceDir(publicId: string, dir: string): Promise<{ entries: InstanceFileEntry[]; root: string } | null> {
  try {
    const r = await fetch(`${GATEWAY}/api/v1/instances/${publicId}/files?path=${encodeURIComponent(dir)}`, { credentials: "include" })
    if (!r.ok) return null
    return (await r.json()) as { entries: InstanceFileEntry[]; root: string }
  } catch {
    return null
  }
}

export async function readInstanceText(publicId: string, path: string): Promise<string | null> {
  try {
    const r = await fetch(`${GATEWAY}/api/v1/instances/${publicId}/files/content?path=${encodeURIComponent(path)}`, { credentials: "include" })
    if (!r.ok) return null
    return ((await r.json()) as { content: string }).content
  } catch {
    return null
  }
}
