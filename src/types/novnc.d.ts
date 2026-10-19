// [v3 F1] @novnc/novnc 无官方类型;按 V2 VncPanel 用面声明(仅本 fork 所用)
declare module "@novnc/novnc" {
  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, url: string | URL, options?: {
      credentials?: { password?: string; username?: string }
      shared?: boolean
      credentialsProvider?: () => Promise<{ password?: string }>
    })
    scaleViewport: boolean
    resizeSession: boolean
    background: string
    focus(options?: { preventScroll?: boolean }): void
    blur(): void
    sendCredentials(credentials: { password?: string; username?: string }): void
    sendKey(keysym: number, code: string, down?: boolean): void
    disconnect(): void
  }
}
