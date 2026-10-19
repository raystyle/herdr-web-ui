// [v3 F2] 实例文件面板:右侧 dock(DesktopPanel 同位同 chrome)。单层
// 目录列表+面包屑导航+文本预览(白名单经网关校验);herdr 暗色皮,
// file-panel 系 CSS 复用。编辑抽屉与上传列升级批。
import { useCallback, useEffect, useState } from "react";
import { FileText, Folder, FolderOpen, RotateCw, X } from "lucide-react";
import { useT } from "../lib/i18n.ts";
import { listInstanceDir, readInstanceText, type InstanceFileEntry } from "../lib/instanceFiles.ts";
import "./FileViewer.css";

export interface InstanceFilesPanelProps {
  machineName: string
  publicId: string
  onClose: () => void
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function InstanceFilesPanel({ machineName, publicId, onClose }: InstanceFilesPanelProps) {
  const t = useT();
  const [dir, setDir] = useState<string>("");
  const [root, setRoot] = useState<string>("");
  const [entries, setEntries] = useState<InstanceFileEntry[] | null>(null);
  const [preview, setPreview] = useState<{ path: string; content: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (d: string) => {
    setBusy(true);
    const out = await listInstanceDir(publicId, d);
    setBusy(false);
    if (!out) {
      setEntries(null);
      return;
    }
    setRoot(out.root);
    setDir(d === "" ? out.root : d);
    setEntries([...out.entries].sort((a, b) => (a.type === b.type ? a.path.localeCompare(b.path) : a.type === "d" ? -1 : 1)));
  }, [publicId]);

  useEffect(() => {
    void load("");
  }, [load]);

  const openEntry = async (e: InstanceFileEntry) => {
    if (e.type === "d") {
      setPreview(null);
      void load(e.path);
      return
    }
    setPreview({ path: e.path, content: null });
    const content = await readInstanceText(publicId, e.path);
    setPreview({ path: e.path, content });
  };

  const crumbs = dir && root && dir.startsWith(root) ? dir.slice(root.length).split("/").filter(Boolean) : [];

  return (
    <aside className="file-panel web-panel" aria-label={`${machineName} · ${t("Files")}`}>
      <section className="file-viewer file-viewer-docked">
        <header className="file-viewer-header file-viewer-header-docked">
          <FolderOpen aria-hidden="true" className="file-viewer-glyph" />
          <h2 className="file-viewer-name" title={machineName}>
            <span className="file-viewer-stem">{machineName}</span>
          </h2>
          <div className="file-viewer-actions">
            <button type="button" className="icon-button file-viewer-action" aria-label={t("Reload page")} title={t("Reload page")} onClick={() => void load(dir)}><RotateCw aria-hidden="true" /></button>
          </div>
          <button type="button" className="icon-button file-viewer-action file-viewer-close" aria-label={t("Close")} title={t("Close")} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        {/* 面包屑:root 根+逐段下钻;根=实例工作区 /srv/work/<id> */}
        <nav className="file-viewer-header" style={{ borderTop: 0, paddingTop: 0, paddingBottom: "0.25rem" }} aria-label={t("Files")}>
          <button type="button" className="btn" style={{ padding: "0.1rem 0.4rem" }} onClick={() => { setPreview(null); void load(root) }}>
            <Folder aria-hidden="true" />
          </button>
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem" }}>
              <span aria-hidden="true">/</span>
              <button type="button" className="btn" style={{ padding: "0.1rem 0.4rem" }} onClick={() => { setPreview(null); void load(`${root}/${crumbs.slice(0, i + 1).join("/")}`) }}>{c}</button>
            </span>
          ))}
          {busy && <span aria-hidden="true">…</span>}
        </nav>
        <div className="file-viewer-body" style={{ display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
          {preview !== null ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.5rem", borderBottom: "1px solid var(--border)" }}>
                <FileText aria-hidden="true" />
                <span className="file-viewer-stem" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.path.slice(root.length) || preview.path}</span>
                <button type="button" className="btn" style={{ marginLeft: "auto", padding: "0.1rem 0.4rem" }} onClick={() => setPreview(null)}>{t("Close")}</button>
              </div>
              <pre style={{ margin: 0, padding: "0.5rem", overflow: "auto", flex: 1, fontSize: "0.8rem", lineHeight: 1.5 }}>
                {preview.content ?? t("Loading PCs…")}
              </pre>
            </>
          ) : entries === null ? (
            <p role="status" style={{ padding: "1rem", color: "var(--text-dim)" }}>{t("Loading PCs…")}</p>
          ) : entries.length === 0 ? (
            <p role="status" style={{ padding: "1rem", color: "var(--text-dim)" }}>—</p>
          ) : (
            <ul style={{ margin: 0, padding: "0.25rem", listStyle: "none", overflowY: "auto", flex: 1 }}>
              {entries.map((e) => (
                <li key={e.path}>
                  <button type="button" className="btn" style={{ display: "flex", width: "100%", justifyContent: "flex-start", gap: "0.5rem", textAlign: "left" }} onClick={() => void openEntry(e)}>
                    {e.type === "d" ? <Folder aria-hidden="true" style={{ flexShrink: 0 }} /> : <FileText aria-hidden="true" style={{ flexShrink: 0 }} />}
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.path.split("/").pop()}</span>
                    {e.type !== "d" && <span style={{ marginLeft: "auto", color: "var(--text-dim)", flexShrink: 0 }}>{fmtSize(e.size)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </aside>
  )
}
