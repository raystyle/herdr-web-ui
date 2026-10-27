import { useSyncExternalStore } from "react";

// [v3 Kasm 融合批] 安装面全撤:useInstallPrompt/installHelp/beforeinstallprompt
// 拦截与 getInstalledRelatedApps 轮询随 UI 退役;本模块只剩「本窗口是否
// 已装应用的独立窗口」检测(FileViewer 的开新页/复制链接切换在用)。

type Listener = () => void;

let lastAppWindow = false;
let revision = 0;
const listeners = new Set<Listener>();

function emitChange(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): number {
  return revision;
}

// every display mode an installed app can run in; browser and unknown modes are a plain tab
const INSTALLED_DISPLAY_MODES = ["standalone", "minimal-ui", "window-controls-overlay", "tabbed", "unframed"].map((mode) => `(display-mode: ${mode})`);
const FULLSCREEN_DISPLAY = "(display-mode: fullscreen)";

export interface InstalledStateInput {
  matches(query: string): boolean;
  iosStandalone: boolean;
  installedByEvent: boolean;
  relatedInstalled: boolean;
  /** the verdict last returned, kept while fullscreen hides which window this is */
  previous: boolean;
}

/** Whether this page runs as an installed app. Fullscreen (F11, the macOS green button) reports no
 * window mode of its own, so it keeps the previous verdict instead of guessing from the display mode. */
export function installedState(input: InstalledStateInput): boolean {
  const signalled = input.iosStandalone || input.installedByEvent || input.relatedInstalled;
  if (input.matches(FULLSCREEN_DISPLAY)) return input.previous || signalled;
  return signalled || INSTALLED_DISPLAY_MODES.some((query) => input.matches(query));
}

/**
 * Whether this window itself is the installed app's, not a tab of a browser that has the app
 * installed. A link that opens a new tab of this origin (`target="_blank"`) lands in another app
 * window there, since the app's scope is the whole origin and no page can send it to the browser.
 */
export function isAppWindow(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  lastAppWindow = installedState({
    matches: (query) => window.matchMedia?.(query).matches === true,
    iosStandalone: iosNavigator.standalone === true,
    installedByEvent: false,
    relatedInstalled: false,
    previous: lastAppWindow,
  });
  return lastAppWindow;
}

if (typeof window !== "undefined") {
  for (const query of [...INSTALLED_DISPLAY_MODES, FULLSCREEN_DISPLAY]) window.matchMedia?.(query).addEventListener("change", emitChange);
}

/** Whether the page runs in the installed app's own window (isAppWindow), kept current. */
export function useAppWindow(): boolean {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return isAppWindow();
}
