// [v3 单页坍缩] 登录门(F4 终态提前):网关 auth API(用户名/密码/点阵
// 验证码)→ token → entry-ticket 票桥铸 hx_sess → 应用即一页。唯一
// 保留的第二屏(未登录时);网关未启认证则无门直入。
import { useCallback, useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { useT } from "../lib/i18n.ts";
import { HxLogo } from "./HxLogo.tsx";

const GATEWAY = window.location.origin

interface Captcha {
  id: string
  image: string
}

async function fetchCaptcha(): Promise<Captcha | null> {
  try {
    const r = await fetch(`${GATEWAY}/api/v1/auth/captcha`, { credentials: "include" })
    if (!r.ok) return null
    return (await r.json()) as Captcha
  } catch {
    return null
  }
}

/** 会话探测:200=已登录;401=未登录;501 auth_disabled=网关未启认证,
 * 按免登录放行(旧实现只认 r.ok,把 501 误判未登录→登录门常驻,2026-10-26 实证)。 */
export async function probeSession(): Promise<boolean> {
  try {
    const r = await fetch(`${GATEWAY}/api/v1/auth/ws-ticket`, { credentials: "include" })
    return r.ok || r.status === 501
  } catch {
    return false
  }
}

export function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const t = useT();
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCaptcha = useCallback(async () => {
    setCaptcha(await fetchCaptcha());
  }, []);
  useEffect(() => { void refreshCaptcha() }, [refreshCaptcha]);

  const submit = async () => {
    if (busy || !captcha) return
    setBusy(true)
    setError(null)
    try {
      const login = await fetch(`${GATEWAY}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, captchaId: captcha.id, captcha: code }),
      })
      const lj = (await login.json()) as { token?: string; error?: { message?: string } }
      if (!login.ok || !lj.token) {
        setError(lj.error?.message ?? `${login.status}`)
        setCode("")
        await refreshCaptcha()
        return
      }
      // 票桥铸网关域会话 cookie(hx_sess):entry-ticket→__entry→302 回根
      const ticket = await fetch(`${GATEWAY}/api/v1/control/entry-ticket`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${lj.token}` },
      })
      const tj = (await ticket.json()) as { path?: string }
      if (ticket.ok && tj.path) {
        window.location.href = tj.path
        return
      }
      setError(`${ticket.status}`)
      await refreshCaptcha()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", zIndex: 1000 }}>
      <form className="menu" style={{ display: "grid", gap: "0.7rem", padding: "1.6rem", minWidth: "20rem" }}
        onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
          <HxLogo size={30} />
          <span style={{ fontSize: "1.15rem", fontWeight: 600 }}>皓玄</span>
        </div>
        <label className="field">
          <span className="field-label">{t("User name")}</span>
          <input className="input" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t("Passphrase")}</span>
          <input className="input" type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t("Access code")}</span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input className="input" value={code} maxLength={8} style={{ flex: 1 }} onChange={(e) => setCode(e.target.value)} />
            {captcha?.image
              ? <img src={captcha.image} alt={t("Access code")} height={34} style={{ cursor: "pointer", borderRadius: "4px" }} onClick={() => void refreshCaptcha()} />
              : <button type="button" className="icon-button" aria-label={t("Reload page")} onClick={() => void refreshCaptcha()}><RotateCw aria-hidden="true" /></button>}
          </div>
        </label>
        {error && <p role="alert" style={{ color: "var(--danger-text)", margin: 0 }}>{error}</p>}
        <button className="btn" type="submit" disabled={busy || !username || !password || !code}>{busy ? t("Loading PCs…") : t("Sign in")}</button>
      </form>
    </div>
  )
}
