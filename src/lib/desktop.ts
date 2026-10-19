// [v3 F1] 实例桌面面板连接面(纯函数,V2 VncPanel 逻辑移植,皮全弃):
// 口令取(网关 REST,网关域会话 cookie)、RFB WS 拼(/i/<id>/desktop
// 经网关 iproxy 透传到实例 /desktop 桥→acpsup)、分辨率上报。
const BASE = window.location.pathname.replace(/\/[^/]*$/, "")

export async function fetchDesktopPassword(publicId: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/v1/instances/${publicId}/vnc/desktop`, { credentials: "include" })
    if (!r.ok) return null
    const info = (await r.json()) as { password?: string }
    return info.password ?? null
  } catch {
    return null
  }
}

export function desktopWsUrl(publicId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}${BASE}/i/${publicId}/desktop`
}

export function reportResolution(publicId: string, width: number, height: number): void {
  void fetch(`/api/v1/instances/${publicId}/vnc/resolution`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ width, height }),
  }).catch(() => {})
}
