import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// the faces the tokens name, then styles.css before any component: it holds the primitives
// (.btn, .input, .menu…) that component stylesheets override, and Vite emits CSS in import order
import "./fonts/fonts.css";
import "./styles.css";
import { App } from "./App.tsx";
import { AppCrash, CrashProbe } from "./components/AppCrash.tsx";
import { FileReader } from "./components/FileReader.tsx";
import { RenderBoundary } from "./components/RenderBoundary.tsx";
import { readerFromSearch } from "./lib/fileReader.ts";
import { SettingsProvider } from "./lib/settings.ts";
import { isReportableWindowError } from "./lib/uncaughtErrors.ts";
import "./lib/viewport.ts";
import { watchSheetExits } from "./lib/sheets.ts";

// [v3] 部署基址前缀(网关 /i/{id}/ 代理形态):从页面路径导出,根部署为空串。
// 最小 hack 面:根相对 URL 经此补前缀;绝对 URL 与非 / 开头原样。
export const basePath = window.location.pathname.replace(/\/[^/]*$/, "");
{
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const patched = url.startsWith("/") ? basePath + url : url;
    return orig(patched, init);
  }) as typeof window.fetch;
}

// a phone's sheets drop back down however they close (lib/sheets.ts)
watchSheetExits();

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

// a markdown file opened in a tab of its own is that page alone, not the app (FileReader)
const reader = readerFromSearch(window.location.search);

// an error nothing else caught still reaches the console under one name, where a bug report can find it
// (but not the browser's benign ResizeObserver loop notice: lib/uncaughtErrors.ts)
window.addEventListener("error", (event) => {
  if (isReportableWindowError(event.error, event.message)) console.error("herdr-web-ui: uncaught error", event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => console.error("herdr-web-ui: unhandled rejection", event.reason));

// A render error the parts below do not catch would unmount the whole tree and leave the page
// blank, and an installed web app has no reload button: AppCrash offers one. It sits outside
// SettingsProvider, which may be what threw.
// [v3 单页坍缩] 根级登录门:总控形(meta 旗)且未持网关会话时,整树
// 只渲染 LoginGate——fork 自身配对门/应用全在其下,登录(票桥铸
// hx_sess)后 __entry 302 整页重载,此处放行全应用。根级拦截先于一切
// fork 启动副作用(fetch 补丁已装,探测自走网关面)。
async function boot() {
  const consoleForm = document.querySelector('meta[name="hx-console"]')?.getAttribute("content") === "1";
  if (container === null) throw new Error("#root is missing from index.html");
  const root = container;
  let gated = false;
  if (consoleForm) {
    const { LoginGate, probeSession } = await import("./components/LoginGate.tsx");
    gated = !(await probeSession());
    if (gated) {
      createRoot(root).render(
        <StrictMode>
          <LoginGate onAuthed={() => { window.location.href = "/" }} />
        </StrictMode>,
      );
      return;
    }
  }
  createRoot(root).render(
    <StrictMode>
      <RenderBoundary resetKey={null} fallback={(_retry, error) => <AppCrash error={error} />}>
        <CrashProbe region="root" />
        <SettingsProvider>
          {reader !== null ? <FileReader target={reader} /> : <App />}
        </SettingsProvider>
      </RenderBoundary>
    </StrictMode>,
  );
}
void boot();
