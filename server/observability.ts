/**
 * [v3 V3-O] Bun.serve 手包观测面(grok 选型:Bun 无自动仪器,Railway/Datadog
 * 不支持运行时指南同形)——一请求一 span(traceparent Extract:网关注入的
 * HTTP 链续传;socket 面零改帧);WS 只做握手 span+活跃计数+升级失败计数
 * (503 desktop_not_configured/502 上游败/426 非升级分开);OTLP 出宿主
 * collector。指标属性低基数:路由类别/方法/状态类——不带 query/用户。
 */
import { context, metrics, propagation, trace, type Span } from "@opentelemetry/api";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://10.10.10.16:4318";

let booted = false;

/** 服务名:总控壳=haoxuan-console;实例面(HERDR_SOCKET 在)=haoxuan-instance。 */
function serviceName(): string {
  if (process.env.HERDR_OTEL_SERVICE) return process.env.HERDR_OTEL_SERVICE;
  return process.env.HERDR_SOCKET ? "haoxuan-instance" : "haoxuan-console";
}

/** 幂等装配(main 起服时一次;测试环境 noop 不出网)。 */
export function setupObservability(): void {
  if (booted) return;
  booted = true;
  const resource = new Resource({ "service.name": serviceName() });
  const tracerProvider = new BasicTracerProvider({ resource });
  tracerProvider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })));
  tracerProvider.register();
  const meterProvider = new MeterProvider({
    resource,
    readers: [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 30_000,
    })],
  });
  metrics.setGlobalMeterProvider(meterProvider);
}

const meter = metrics.getMeter(serviceName());

// ---- 指标仪 ----
const wsActive = meter.createUpDownCounter("haoxuan_ws_active", { description: "WS 活跃连接(/ws+/desktop)" });
const wsUpgradeFail = meter.createCounter("haoxuan_ws_upgrade_fail_total", { description: "WS 升级失败(426/502/503 等)" });

export function wsConnect(kind: string): void { wsActive.add(1, { path: kind }); }
export function wsDisconnect(kind: string): void { wsActive.add(-1, { path: kind }); }
export function wsUpgradeFailure(kind: string, status: string): void {
  wsUpgradeFail.add(1, { path: kind, status });
}

/** 路由类别:query 剥净,首段+次段(/api/foo/bar→api_foo;根/资产→other)。 */
function routeClass(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0] === "api") return `api_${parts[1] ?? "x"}`;
  if (parts.length >= 1) return parts[0] ?? "root";
  return "root";
}

/**
 * fetch 包装:Extract(traceparent)→ server span → 内层处理 → End(状态类)。
 * 一请求一 span,返回时结束(WS 升级请求亦同——span=握手时长,连接生命
 * 周期不入 span)。
 */
export function withRequestSpan<T>(request: Request, run: () => Promise<T>): Promise<T> {
  const tracer = trace.getTracer("haoxuan-web");
  // 显式 getter(propagation.extract 第三参;缺省 getter 按属性直取,自定义
  // 对象的 get() 不会被调——首发即此坑,跨服务链断)
  const ctx = propagation.extract(context.active(), request.headers, {
    get: (headers, key) => headers.get(key) ?? undefined,
    keys: (headers) => [...headers.keys()],
  });
  const url = new URL(request.url);
  const span = tracer.startSpan(
    `${request.method} ${routeClass(url.pathname)}`,
    { kind: 1, attributes: {
      "http.request.method": request.method,
      "url.path": url.pathname,
      "haoxuan.route_class": routeClass(url.pathname),
    } },
    ctx,
  );
  return context.with(trace.setSpan(ctx, span), async () => {
    try {
      const out = await run();
      if (out instanceof Response) {
        span.setAttribute("http.response.status_code", out.status);
        if (out.status >= 500) span.recordException(new Error(`status ${out.status}`));
      }
      return out;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: 2, message: "error" });
      throw error;
    } finally {
      span.end();
    }
  });
}

/** WS 握手 span(升级成败即 End;活跃计数另走 gauge)。 */
export function withHandshakeSpan<T>(kind: string, run: () => T): T {
  const tracer = trace.getTracer("haoxuan-web");
  const span = tracer.startSpan(`ws-handshake ${kind}`, { kind: 1, attributes: { "haoxuan.ws.path": kind } });
  try {
    const out = run();
    span.setAttribute("haoxuan.ws.upgraded", true);
    return out;
  } catch (error) {
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

// ---- herdr RPC client span(响应 id 包;socket 面零改帧,herdr 进程内
// 缺口留白记档——client span 即链尾)----
const openRpcSpans = new Map<string, Span>();

export function rpcSpanStart(id: string, method: string): void {
  const span = trace.getTracer("haoxuan-herdr").startSpan(method, { kind: 3, attributes: { "haoxuan.rpc.id": id } });
  openRpcSpans.set(id, span);
}

export function rpcSpanEnd(id: string, failed: boolean): void {
  const span = openRpcSpans.get(id);
  if (!span) return;
  openRpcSpans.delete(id);
  if (failed) span.setStatus({ code: 2, message: "rpc error" });
  span.end();
}
