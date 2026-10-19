// [v3 F1] 实例桌面面板:noVNC 容器,右侧 dock(WebPanel 同位同 chrome,
// file-panel 系 CSS 复用,herdr 暗色皮)。V2 VncPanel 逻辑保真移植:
// 口令长活缓存(连前取一次)、失焦不抢、键盘仅画面内、单连纪律(父态切机
// 先断)。断线横幅+重连。分辨率跟随单一权限走 REST 上报道(V2 E44 已验):
// x11vnc 对 RFB SetDesktopSize 的奇尺寸请求不可靠且与 REST 抢档,故
// resizeSession 恒关,scaleViewport 只管 contain 缩放兜底。
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import RFB from "@novnc/novnc";
import { Maximize2, Monitor, RotateCw, X } from "lucide-react";
import { useT } from "../lib/i18n.ts";
import { desktopWsUrl, fetchDesktopPassword, reportResolution } from "../lib/desktop.ts";
import "./FileViewer.css";

export interface DesktopPanelProps {
  machineName: string
  publicId: string
  onClose: () => void
  panelStart?: ReactNode
}

type DeskState = "connecting" | "live" | "lost"

export function DesktopPanel({ machineName, publicId, onClose, panelStart }: DesktopPanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rfbRef = useRef<RFB | null>(null);
  const passRef = useRef<string | null>(null);
  const liveRef = useRef(false);
  const resoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resoReported = useRef({ w: 0, h: 0 });
  const [state, setState] = useState<DeskState>("connecting");
  const [note, setNote] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    const rfb = rfbRef.current;
    rfbRef.current = null;
    liveRef.current = false;
    if (rfb) {
      rfb.scaleViewport = false;
      try { rfb.disconnect(); } catch { /* already gone */ }
    }
  }, []);

  // 面板尺寸→远端分辨率跟随(V2 E44 纪律):CSS 像素偶数对齐(xrandr 要
  // 求)、下限跳过(过小不值得切档,contain 缩放兜底)、±32 死区防抖动、
  // 800ms debounce;只有 live 才报(未连上报无的放矢)。
  const report = useCallback(() => {
    const el = hostRef.current;
    if (!el || !liveRef.current) return;
    const w = Math.round(el.clientWidth / 2) * 2;
    const h = Math.round(el.clientHeight / 2) * 2;
    if (w < 480 || h < 360) return;
    if (Math.abs(w - resoReported.current.w) < 32 && Math.abs(h - resoReported.current.h) < 32) return;
    resoReported.current = { w, h };
    reportResolution(publicId, w, h);
  }, [publicId]);
  const scheduleReport = useCallback((delay = 800) => {
    if (resoTimer.current !== undefined) clearTimeout(resoTimer.current);
    resoTimer.current = setTimeout(() => { resoTimer.current = undefined; report(); }, delay);
  }, [report]);

  const connect = useCallback(async () => {
    disconnect();
    setState("connecting");
    setNote(null);
    if (passRef.current === null) passRef.current = await fetchDesktopPassword(publicId);
    if (passRef.current === null) {
      setState("lost");
      setNote(t("Desktop password is unavailable"));
      return;
    }
    const rfb = new RFB(hostRef.current!, desktopWsUrl(publicId), {
      credentials: { password: passRef.current },
    });
    rfb.scaleViewport = true;
    rfb.resizeSession = false;
    rfb.background = "transparent";
    rfb.addEventListener("connect", () => {
      liveRef.current = true;
      setState("live");
      scheduleReport(); // 连上即对齐一次(满铺首帧)
    });
    rfb.addEventListener("disconnect", () => {
      if (rfbRef.current === rfb) {
        rfbRef.current = null;
        liveRef.current = false;
        setState("lost");
        setNote(t("The desktop connection ended"));
      }
    });
    rfbRef.current = rfb;
  }, [disconnect, publicId, scheduleReport, t]);

  useEffect(() => {
    void connect();
    return () => {
      if (resoTimer.current !== undefined) clearTimeout(resoTimer.current);
      disconnect();
    };
  }, [connect, disconnect]);

  // 分辨率跟随:dock 体尺寸变化(拖宽/缩窗/全屏)续报
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => scheduleReport());
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleReport]);

  const fullscreen = () => {
    const frame = hostRef.current?.closest(".file-viewer");
    if (frame && !document.fullscreenElement) void frame.requestFullscreen().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };

  return (
    <aside className="file-panel web-panel" aria-label={`${machineName} · ${t("Desktop")}`}>
      {panelStart}
      <section className="file-viewer file-viewer-docked">
        <header className="file-viewer-header file-viewer-header-docked">
          <Monitor aria-hidden="true" className="file-viewer-glyph" />
          <h2 className="file-viewer-name" title={machineName}>
            <span className={`machine-dot is-${state === "live" ? "connected" : state === "lost" ? "error" : "connecting"}`} aria-hidden="true" />
            <span className="file-viewer-stem">{machineName}</span>
          </h2>
          <div className="file-viewer-actions">
            <button type="button" className="icon-button file-viewer-action" aria-label={t("Reconnect")} title={t("Reconnect")} onClick={() => void connect()}><RotateCw aria-hidden="true" /></button>
            <button type="button" className="icon-button file-viewer-action" aria-label={t("Fullscreen")} title={t("Fullscreen")} onClick={fullscreen}><Maximize2 aria-hidden="true" /></button>
          </div>
          <button type="button" className="icon-button file-viewer-action file-viewer-close" aria-label={t("Close")} title={t("Close")} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <div className="file-viewer-body" style={{ position: "relative", background: "var(--bg)" }}>
          <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
          {state !== "live" && (
            <div role="status" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.6rem", color: "var(--text-dim)" }}>
              <Monitor aria-hidden="true" />
              <p>{state === "connecting" ? t("Connecting…") : note ?? t("The desktop connection ended")}</p>
              {state === "lost" && <button className="btn" onClick={() => void connect()}>{t("Reconnect")}</button>}
            </div>
          )}
        </div>
      </section>
    </aside>
  )
}
