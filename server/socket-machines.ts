// [v3] socket-machine 桥生命周期(V3 复启令⑤,链接道 B):
// 每台 socket 型 machine = 一个本地 remote-entry 桥进程,其 HERDR_SOCKET
// 指向编排器的 incus unix↔unix 代理 socket(→ 容器 herdr.sock)。零 SSH、
// 零远端 bundle;descriptor 按	socket 哈希键落共享注册表(bridge.ts),
// 活桥复用(同名不重启),死描述符重 spawn。
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { descriptorPath, type BridgeDescriptor } from "./bridge.ts";

export interface SocketBridge {
  url: string;
  token: string;
  pid: number;
}

function readDescriptor(socketPath: string): BridgeDescriptor | null {
  try {
    const d = JSON.parse(readFileSync(descriptorPath(resolve(socketPath)), "utf8")) as BridgeDescriptor;
    if (!Number.isInteger(d.pid) || !Number.isInteger(d.port) || typeof d.token !== "string") return null;
    return d;
  } catch {
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * 确保一台 socket 桥在跑:活 descriptor 复用;否则 spawn remote-entry
 * (cwd=本进程 checkout 根,继承 bun 运行时)并轮询 descriptor 就绪。
 * spawn 失败/超时抛错(调用方进 retryLater 退避)。
 */
export async function ensureSocketBridge(socketPath: string, timeoutMs = 60_000): Promise<SocketBridge> {
  const abs = resolve(socketPath);
  const existing = readDescriptor(abs);
  if (existing && alive(existing.pid)) {
    return { url: `http://127.0.0.1:${existing.port}`, token: existing.token, pid: existing.pid };
  }
  // process.execPath=本进程 bun 绝对路径(systemd 服的 PATH 可无 bun)
  const proc = Bun.spawn(
    [process.execPath, "run", "server/remote-entry.ts"],
    {
      cwd: join(import.meta.dir, ".."),
      env: { ...process.env, HERDR_SOCKET: abs },
      stdin: "ignore",
      stdout: Bun.file(join(descriptorPath(abs) + ".log")),
      stderr: Bun.file(join(descriptorPath(abs) + ".log")),
    },
  );
  proc.unref();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const d = readDescriptor(abs);
    if (d && alive(d.pid)) return { url: `http://127.0.0.1:${d.port}`, token: d.token, pid: d.pid };
    // spawn 立即死(如 socket 不通)不必等满
    if (proc.exitCode !== null) break;
    await Bun.sleep(300);
  }
  throw new Error(`socket bridge did not come up for ${abs} (see bridges/*.json.log)`);
}

/** 停掉一台 socket 桥(machine 删除/禁用;SIGTERM 走 remote-entry 的优雅收尾)。 */
export function killSocketBridge(socketPath: string): void {
  const d = readDescriptor(resolve(socketPath));
  if (d && d.managed_remote !== false) {
    try {
      process.kill(d.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}
