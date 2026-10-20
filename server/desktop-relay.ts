/**
 * v3 spike C (/desktop): the browser's desktop window is a noVNC client; the
 * GUI stream does not ride herdr (it owns terminal bytes only), so the panel
 * hangs off the web-ui server as a same-origin WebSocket that bridges
 * BINARY frames to the instance's acpsup VNC endpoint (RFB-over-WS at
 * 127.0.0.1:7663/vnc, Bearer-authenticated). Unlike MachineRelay (text
 * terminal frames with ACK windows), this pipe is raw binary both ways with
 * no framing of our own - noVNC and x11vnc speak RFB to each other through
 * us, and a stall is simply TCP backpressure.
 *
 * Reuses the whole existing auth chain: the route admits only what the rest
 * of the server would admit (same-origin + access level), so no second auth
 * surface is born here. Upstream target and key come from the environment,
 * never from the browser request.
 */
import type { ServerWebSocket } from "bun";

export interface DesktopTarget {
  /** ws:// URL of the acpsup VNC endpoint, e.g. ws://127.0.0.1:7663/vnc. */
  url: string;
  /** The Bearer token for acpsup (the instance key; never client-supplied). */
  token: string;
}

/** Reads the spike's env contract; undefined when no desktop is configured. */
export function desktopTargetFromEnv(env: Record<string, string | undefined> = process.env): DesktopTarget | undefined {
  const url = env["HERDR_DESKTOP_TARGET"];
  const token = env["HERDR_DESKTOP_TOKEN"];
  if (!url || !token) return undefined;
  return { url, token };
}

/** Bridge state: one browser WS, one upstream WS, binary bytes both ways. */
export class DesktopRelay {
  private upstream: WebSocket;
  private client?: ServerWebSocket<unknown>;
  private waiting: Buffer[] = [];
  private closed = false;
  /** F-3 (kimi 终审): watch role sees the desktop but its input never lands. */
  private readonly readOnly: boolean;
  readonly ready: Promise<void>;

  constructor(target: DesktopTarget, readOnly = false) {
    this.readOnly = readOnly;
    // Bun supports client headers; lib.dom's constructor overload hides that
    // option (same cast as authenticatedWebSocket). Binary both ways, and
    // acpsup REQUIRES the binary subprotocol declared at upgrade (it closes
    // with 4080 "协议须 binary" otherwise - hx-spike-a live finding).
    this.upstream = new (WebSocket as unknown as new (
      url: string,
      options: { headers: Record<string, string>; protocols?: string | string[] },
    ) => WebSocket)(target.url, {
      headers: { authorization: `Bearer ${target.token}` },
      protocols: ["binary"],
    });
    (this.upstream as WebSocket & { binaryType: "arraybuffer" }).binaryType = "arraybuffer";
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.close(1012, "desktop upstream timed out");
        reject(new Error("desktop upstream timed out"));
      }, 15_000);
      this.upstream.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.upstream.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("desktop upstream unavailable"));
        this.close(1012, "desktop upstream unavailable");
      }, { once: true });
      this.upstream.addEventListener("close", () => {
        clearTimeout(timeout);
        reject(new Error("desktop upstream closed"));
      }, { once: true });
    });
    this.upstream.addEventListener("message", (event) => {
      if (this.closed) return;
      const data = typeof event.data === "string" ? Buffer.from(event.data, "utf8") : Buffer.from(event.data as ArrayBuffer);
      if (!this.client) {
        this.waiting.push(data);
      } else {
        this.client.send(data);
      }
    });
    this.upstream.addEventListener("close", (event) => {
      this.close(event.code === 1000 ? 1000 : 1012, "desktop upstream ended");
    });
  }

  /** The upgrade succeeded: attach the browser socket and flush what waited. */
  bind(client: ServerWebSocket<unknown>): void {
    this.client = client;
    if (this.closed) {
      client.close(1012, "desktop upstream ended");
      return;
    }
    for (const buffered of this.waiting) client.send(buffered as Buffer);
    this.waiting = [];
  }

  /** Binary frame from the browser: straight up (watch role: input types dropped). */
  message(raw: string | Buffer): void {
    if (this.closed) return;
    if (this.upstream.readyState !== WebSocket.OPEN) {
      this.close(1012, "desktop upstream ended");
      return;
    }
    if (this.readOnly) {
      // F-3 (kimi 终审): watch 只看不摸。RFB 客户端消息按型过滤——但中继
      // 是裸字节管道,分不清握手帧与消息帧(首字节空间冲突:DES 响应/
      // ClientInit 的首字节可为任意值),按「输入消息的精确形」过滤:
      // KeyEvent=型4 恰 8 字节,PointerEvent=型5 恰 6 字节,ClientCutText=
      // 型6 且非 16 字节(16 让给 DES 响应形)。握手帧(12B 版本/1B 安全选/
      // 16B DES/1B ClientInit)与渲染必需(0/2/3)全放行——watch 能看不能摸。
      const type = typeof raw === "string" ? raw.charCodeAt(0) : raw[0];
      const len = raw.length;
      if ((type === 4 && len === 8) || (type === 5 && len === 6) || (type === 6 && len !== 16)) return;
    }
    this.upstream.send(typeof raw === "string" ? raw : new Uint8Array(raw));
  }

  close(code = 1000, reason = "Closed"): void {
    if (this.closed) return;
    this.closed = true;
    this.waiting = [];
    const bounded = Buffer.from(reason).subarray(0, 100).toString("utf8");
    try { this.upstream.close(code, bounded); } catch { /* already closing */ }
    this.client?.close(code, bounded);
  }
}
