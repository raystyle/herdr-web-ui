// [v3 F1] 实例桌面面板:noVNC 容器,右侧 dock(WebPanel 同位同 chrome,
// file-panel 系 CSS 复用,herdr 暗色皮)。V2 VncPanel 逻辑保真移植:
// 口令长活缓存(连前取一次)、resizeSession、失焦不抢、键盘仅画面内、
// 单连纪律(父态切机先断)。断线横幅+重连。
import { useCallback, useEffect, useRef, useState } from "react";
import RFB from "@novnc/novnc";
import { Maximize2, Monitor, RotateCw, X } from "lucide-react";
import { useT } from "../lib/i18n.ts";
import { desktopWsUrl, fetchDesktopPassword, reportResolution } from "../lib/desktop.ts";
import "./FileViewer.css";

export interface DesktopPanelProps {
  machineName: string
  publicId: string
  onClose: () => void
}

type DeskState = "connecting" | "live" | "lost"

export function DesktopPanel({ machineName, publicId, onClose }: DesktopPanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rfbRef = useRef<RFB | null>(null);
  const passRef = useRef<string | null>(null);
  const [state, setState] = useState<DeskState>("connecting");
  const [note, setNote] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    const rfb = rfbRef.current;
    rfbRef.current = null;
    if (rfb) {
      rfb.scaleViewport = false;
      rfb.resizeSession = false;
      try { rfb.disconnect(); } catch { /* already gone */ }
    }
  }, []);

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
    rfb.resizeSession = true;
    rfb.background = "transparent";
    rfb.addEventListener("connect", () => setState("live"));
    rfb.addEventListener("disconnect", () => {
      if (rfbRef.current === rfb) {
        rfbRef.current = null;
        setState("lost");
        setNote(t("The desktop connection ended"));
      }
    });
    rfbRef.current = rfb;
  }, [disconnect, publicId, t]);

  useEffect(() => {
    void connect();
    return disconnect;
  }, [connect, disconnect]);

  // 分辨率跟随:dock 体尺寸变化即上报(容器侧 xrandr 切档)
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const report = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      if (w > 0 && h > 0) reportResolution(publicId, w, h);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [publicId]);

  const fullscreen = () => {
    const frame = hostRef.current?.closest(".file-viewer");
    if (frame && !document.fullscreenElement) void frame.requestFullscreen().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };

  return (
    <aside className="file-panel web-panel" aria-label={`${machineName} · ${t("Desktop")}`}>
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
