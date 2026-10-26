// [v3 F3] 实例生命周期(网关 REST,网关域会话 cookie;origin 绝对 URL
// 绕基址 fetch 补丁)。类型位:kind=system|app(app F5 役,面暂禁用);
// agents=首启自动编排多选(pi/claude/codex,缺省 ["pi"])。
const GATEWAY = window.location.origin

export type InstanceKind = "system" | "app"
export type AgentKind = "pi" | "claude" | "codex" | "grok" | "kimi"
/** agentType(网关侧类型)与 herdr kind 一一对应 */
export type GatewayAgentType = "claude-code" | "codex" | "pi-rs" | "grok" | "kimi"

export interface InstanceRow {
  id: string
  name: string
  status: string
  kind?: string
}

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  try {
    const r = await fetch(`${GATEWAY}/api/v1${path}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    let data: T | null = null
    let error: string | null = null
    try {
      const j = (await r.json()) as { instance?: T; error?: { message?: string } }
      data = (j.instance as T) ?? (j as unknown as T)
      error = j.error?.message ?? null
    } catch { /* non-json */ }
    return { ok: r.ok, status: r.status, data, error }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export function createInstance(name: string, kind: InstanceKind = "system", agents: AgentKind[] = ["pi"], agentType: GatewayAgentType = "pi-rs") {
  return call<InstanceRow>("POST", "/instances", { name, agentType, kind, agents })
}
export function wakeInstance(publicId: string) {
  return call<InstanceRow>("POST", `/instances/${encodeURIComponent(publicId)}/start`)
}
export function pauseInstance(publicId: string) {
  return call<InstanceRow>("POST", `/instances/${encodeURIComponent(publicId)}/stop`)
}
export function destroyInstance(publicId: string) {
  return call<unknown>("DELETE", `/instances/${encodeURIComponent(publicId)}`)
}
export function listInstances() {
  return call<{ instances?: InstanceRow[]; instance?: InstanceRow[] } | InstanceRow[]>("GET", "/instances")
}
