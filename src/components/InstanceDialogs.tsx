// [v3 F5] 实例生命周期对话框+行操作(总控台内建实例管理):
// 新建(名+类型 system|app 双现役+首启 agent 多选 pi/claude/codex)、
// 暂停/唤醒/销毁(经网关 REST,cookie)。
import { useState } from "react";
import { Bot, Monitor, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useT } from "../lib/i18n.ts";
import { createInstance, type AgentKind, type InstanceKind } from "../lib/instanceLifecycle.ts";

/** 新建实例对话框(F5:类型 system|app 双现役;首启 agent 多选:缺省 pi,
 * 可多选,全不勾=不编排——on-ready 钩子经 socket 道补建,两型同律)。 */
export function NewInstanceDialog({ onDone, onClose }: { onDone: (id: string) => void; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<InstanceKind>("system");
  const [agents, setAgents] = useState<Record<AgentKind, boolean>>({ pi: true, claude: false, codex: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    const picked = (Object.keys(agents) as AgentKind[]).filter((k) => agents[k])
    const r = await createInstance(name.trim(), kind, picked)
    setBusy(false)
    if (r.ok && r.data && typeof r.data === "object" && "id" in r.data) {
      onDone(String((r.data as { id: string }).id))
      return
    }
    setError(r.error ?? `${r.status}`)
  }

  return (
    <div className="settings-open" role="dialog" aria-label={t("New instance")}>
      <section className="menu" style={{ minWidth: "22rem", display: "grid", gap: "0.6rem", padding: "0.9rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>{t("New instance")}</h2>
        <label className="field">
          <span className="field-label">{t("PC name")}</span>
          <input className="input" value={name} maxLength={64} autoFocus onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit() }} placeholder="v3-instance" />
        </label>
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "0.3rem" }}>
          <legend className="field-label" style={{ padding: 0 }}>{t("Instance type")}</legend>
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input type="radio" name="hx-kind" checked={kind === "system"} onChange={() => setKind("system")} />
            <Monitor aria-hidden="true" />{t("System container")}
            <span style={{ color: "var(--text-dim)" }}>· {t("desktop, files, terminal")}</span>
          </label>
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input type="radio" name="hx-kind" checked={kind === "app"} onChange={() => setKind("app")} />
            <Plus aria-hidden="true" />{t("App container")}
            <span style={{ color: "var(--text-dim)" }}>· {t("agent-only, no desktop")}</span>
          </label>
        </fieldset>
        {/* 首启 agent 多选:on-ready 编排(经 socket 道 workspace/agent.start);
            kind 名直书(herdr kind 即 CLI 名,无译);全不勾=不编排 */}
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "0.3rem" }}>
          <legend className="field-label" style={{ padding: 0 }}>{t("Startup agents")}</legend>
          {(Object.keys(agents) as AgentKind[]).map((k) => (
            <label key={k} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input type="checkbox" checked={agents[k]} onChange={() => setAgents((a) => ({ ...a, [k]: !a[k] }))} />
              <Bot aria-hidden="true" />{k}
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" style={{ color: "var(--danger-text)", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>{t("Close")}</button>
          <button type="button" className="btn" disabled={!name.trim() || busy} onClick={() => void submit()}>{busy ? t("Loading PCs…") : t("Create")}</button>
        </div>
      </section>
    </div>
  )
}

/** 机器行生命周期钮组(socket 型;暂停/唤醒/销毁,直调网关 REST)。 */
export function InstanceLifecycleActions({ publicId, connected, onActed }: { publicId: string; connected: boolean; onActed: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const act = async (fn: (id: string) => Promise<{ ok: boolean; error: string | null }>) => {
    if (busy) return
    setBusy(true)
    const r = await fn(publicId)
    setBusy(false)
    onActed()
    if (!r.ok && r.error) console.error(r.error)
  }
  return (
    <>
      {connected ? (
        <button className="sidebar-row-action machine-manage" aria-label={t("Pause")} title={t("Pause")} disabled={busy}
          onClick={() => void act(async (id) => (await import("../lib/instanceLifecycle.ts")).pauseInstance(id))}>
          <Pause aria-hidden="true" />
        </button>
      ) : (
        <button className="sidebar-row-action machine-manage" aria-label={t("Reconnect")} title={t("Reconnect")} disabled={busy}
          onClick={() => void act(async (id) => (await import("../lib/instanceLifecycle.ts")).wakeInstance(id))}>
          <Play aria-hidden="true" />
        </button>
      )}
      <button className="sidebar-row-action machine-manage" aria-label={t("Destroy")} title={t("Destroy")} disabled={busy}
        onClick={() => { if (confirm(t("Destroy") + " " + publicId + "?")) void act(async (id) => (await import("../lib/instanceLifecycle.ts")).destroyInstance(id)) }}>
        <Trash2 aria-hidden="true" />
      </button>
    </>
  )
}
