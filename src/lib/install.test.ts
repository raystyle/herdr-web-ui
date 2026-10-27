import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { installedState, isAppWindow, type InstalledStateInput } from "./install.ts";


function detect(modes: string[], rest: Partial<Omit<InstalledStateInput, "matches">> = {}): boolean {
  return installedState({
    matches: (query) => modes.some((mode) => query === `(display-mode: ${mode})`),
    iosStandalone: false,
    installedByEvent: false,
    relatedInstalled: false,
    previous: false,
    ...rest,
  });
}

describe("installedState", () => {
  it("standalone -> installed", () => {
    expect(detect(["standalone"])).toBe(true);
  });

  it("minimal-ui -> installed", () => {
    expect(detect(["minimal-ui"])).toBe(true);
  });

  it("window-controls-overlay -> installed", () => {
    expect(detect(["window-controls-overlay"])).toBe(true);
  });

  it("tabbed -> installed", () => {
    expect(detect(["tabbed"])).toBe(true);
  });

  it("unframed -> installed", () => {
    expect(detect(["unframed"])).toBe(true);
  });

  it("app window in fullscreen keeps the previous verdict", () => {
    expect(detect(["fullscreen"], { previous: true })).toBe(true);
  });

  it("tab in F11 fullscreen is not installed", () => {
    expect(detect(["fullscreen"], { previous: false })).toBe(false);
  });

  it("browser -> not installed", () => {
    expect(detect(["browser"])).toBe(false);
  });

  it("no matching display mode -> not installed", () => {
    expect(detect([])).toBe(false);
  });

  it("iosStandalone -> installed, also while fullscreen", () => {
    expect(detect([], { iosStandalone: true })).toBe(true);
    expect(detect(["fullscreen"], { iosStandalone: true })).toBe(true);
  });

  it("relatedInstalled or installedByEvent -> installed in a browser tab and in fullscreen", () => {
    expect(detect(["browser"], { relatedInstalled: true })).toBe(true);
    expect(detect(["fullscreen"], { relatedInstalled: true })).toBe(true);
    expect(detect(["browser"], { installedByEvent: true })).toBe(true);
  });
});


describe("isAppWindow", () => {
  // the window this page runs in, not whether the app is installed somewhere on the device
  const inWindow = (modes: string[], standalone = false): boolean => {
    const saved = { window: globalThis.window, navigator: globalThis.navigator };
    Object.assign(globalThis, {
      window: { matchMedia: (query: string) => ({ matches: modes.some((mode) => query === `(display-mode: ${mode})`) }) },
      navigator: { standalone },
    });
    try { return isAppWindow(); } finally { Object.assign(globalThis, saved); }
  };

  it("is the app's own window in standalone, minimal-ui or iOS standalone", () => {
    expect(inWindow(["standalone"])).toBe(true);
    expect(inWindow(["minimal-ui"])).toBe(true);
    expect(inWindow([], true)).toBe(true);
  });

  it("is a plain browser tab even after an app window was seen", () => {
    expect(inWindow(["standalone"])).toBe(true);
    expect(inWindow(["browser"])).toBe(false);
  });
});
