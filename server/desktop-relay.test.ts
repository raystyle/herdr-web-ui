import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { DesktopRelay } from "./desktop-relay.ts";

/**
 * F-3 (kimi 终审): the watch role sees the desktop but its input never
 * lands — message() filters RFB client messages by type when readOnly,
 * keeping the rendering protocol alive (pixel format 0 / encodings 2 /
 * update request 3) and dropping the input ones (key 4 / pointer 5 /
 * client cut text 6).
 */
describe("DesktopRelay watch role (F-3)", () => {
  let upstream: Server<undefined>;
  const received: number[] = [];
  beforeAll(() => {
    upstream = Bun.serve({
      port: 0, hostname: "127.0.0.1",
      fetch(request, server) { return server.upgrade(request, { data: undefined }) ? undefined : new Response("no", { status: 400 }); },
      websocket: {
        message(_ws, data) {
          const raw = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
          received.push(raw[0] ?? -1);
        },
      },
    });
  });
  afterAll(() => upstream.stop(true));

  const relayOf = async (readOnly: boolean): Promise<DesktopRelay> => {
    received.length = 0;
    const relay = new DesktopRelay({ url: `ws://127.0.0.1:${upstream.port}`, token: "t" }, readOnly);
    await relay.ready;
    relay.bind({ send: () => {}, close: () => {} } as unknown as Parameters<DesktopRelay["bind"]>[0]);
    return relay;
  };
  // AGENTS.md: bounded polls with deadlines, never fixed sleeps
  const until = async (ok: () => boolean): Promise<void> => {
    const deadline = Date.now() + 5_000;
    while (!ok()) {
      if (Date.now() > deadline) throw new Error("upstream frames not received within 5s");
      await Bun.sleep(25);
    }
  };

  test("watch drops key, pointer and cut-text, keeps the rendering messages", async () => {
    const relay = await relayOf(true);
    relay.message(Buffer.from([4, 1, 0, 0, 0, 41, 0, 95])); // KeyEvent(8B 恰形)
    relay.message(Buffer.from([5, 1, 0, 10, 0, 10])); // PointerEvent(6B 恰形)
    relay.message(Buffer.from([6, 0, 0, 0, 3, 97, 98, 99])); // ClientCutText(非16B)
    relay.message(Buffer.from([2, 0, 0, 0, 0])); // SetEncodings
    relay.message(Buffer.from([3, 1, 0, 0, 0, 10, 10])); // FramebufferUpdateRequest
    relay.message(Buffer.from([0, 0])); // SetPixelFormat
    relay.message(Buffer.from("RFB 003.008\n", "latin1")); // 版本 echo(12B,握手)
    relay.message(Buffer.from([1])); // ClientInit(1B,握手)
    relay.message(Buffer.from([4, 0, 0, 0, 0])); // 5 字节非恰形(如 DES 片段)——放行
    await until(() => received.length >= 6);
    // 弃:键(恰形)/指针(恰形)/剪贴板(非16B);放行:渲染三型+版本echo
    // (首字节 'R'=82)+ClientInit(1)+非恰形片段
    expect(received).toEqual([2, 3, 0, 82, 1, 4]);
    relay.close();
  });

  test("the full role passes input straight through", async () => {
    const relay = await relayOf(false);
    relay.message(Buffer.from([4, 1, 0, 0, 0, 41, 0, 95])); // KeyEvent
    relay.message(Buffer.from([5, 1, 0, 10, 0, 10])); // PointerEvent
    await until(() => received.length >= 2);
    expect(received).toEqual([4, 5]);
    relay.close();
  });
});
