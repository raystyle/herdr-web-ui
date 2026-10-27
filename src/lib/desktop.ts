// [v3 F1] 实例桌面面板连接面(纯函数,V2 VncPanel 逻辑移植,皮全弃):
// 口令取(网关 REST,网关域会话 cookie)、RFB WS 拼(/i/<id>/desktop
// 经网关 iproxy 透传到实例 /desktop 桥→acpsup)、分辨率上报。

// 网关 REST 走 origin 绝对形:绕过 main.tsx 的基址 fetch 补丁(它会把
// 根相对 /api/... 改写成 /control/api/... 打到 web-ui 后端)
const GATEWAY = window.location.origin

export async function fetchDesktopPassword(publicId: string): Promise<string | null> {
  try {
    const r = await fetch(`${GATEWAY}/api/v1/instances/${encodeURIComponent(publicId)}/vnc/desktop`, { credentials: "include" })
    if (!r.ok) return null
    const info = (await r.json()) as { password?: string }
    return info.password ?? null
  } catch {
    return null
  }
}

export function desktopWsUrl(publicId: string): string {
  // [v3 修正] 走网关自带 VNC WS 面(/api/v1/instances/:id/vnc,同源免 Origin 摩
  // 擦;网关拨实例 acpsup /vnc?display=desktop 并注入实例键)——原 /i/<id>/desktop
  // 道依赖实例插件带 /desktop 桥(devswha 上游无此路由,恒 SPA 200 断连)。
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/api/v1/instances/${encodeURIComponent(publicId)}/vnc`
}

export function reportResolution(publicId: string, width: number, height: number): void {
  void fetch(`${GATEWAY}/api/v1/instances/${encodeURIComponent(publicId)}/vnc/resolution`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ width, height }),
  }).catch(() => {})
}
