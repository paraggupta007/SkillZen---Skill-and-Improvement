// Ordered provider fallback with bounded attempts and per-provider circuit breakers.
import type {
  ILLMProvider,
  IUsageRepository,
  LLMRequest,
  LLMResponse,
  UsageRecord,
} from "./types.js";
interface Circuit {
  failures: number;
  openUntil: number;
}
/** Route generation through independent provider strategies. */
export class LLMRouter {
  private readonly circuits = new Map<string, Circuit>();
  /** Inject the ordered strategies and optional usage sink. */
  constructor(
    private readonly providers: ILLMProvider[],
    private readonly usage?: IUsageRepository,
    private readonly options: {
      timeoutMs?: number;
      failureThreshold?: number;
      cooldownMs?: number;
    } = {},
  ) {}
  private enabled(provider: ILLMProvider) {
    return (this.circuits.get(provider.name)?.openUntil ?? 0) <= Date.now();
  }
  private success(provider: ILLMProvider) {
    this.circuits.delete(provider.name);
  }
  private failure(provider: ILLMProvider) {
    const previous = this.circuits.get(provider.name);
    const failures =
      (previous && previous.openUntil <= Date.now() ? previous.failures : 0) +
      1;
    this.circuits.set(provider.name, {
      failures,
      openUntil:
        failures >= (this.options.failureThreshold ?? 3)
          ? Date.now() + (this.options.cooldownMs ?? 30000)
          : 0,
    });
  }
  private log(record: UsageRecord) {
    if (this.usage) void this.usage.record(record).catch(() => undefined);
  }
  /** Generate text with one retry per provider, then try the next healthy circuit. */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    for (const provider of this.providers) {
      if (!this.enabled(provider)) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (req.signal?.aborted) throw new Error("Generation cancelled");
        const started = Date.now();
        const controller = new AbortController();
        const signal = req.signal
          ? AbortSignal.any([req.signal, controller.signal])
          : controller.signal;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("AI provider timed out"));
            }, this.options.timeoutMs ?? 15000);
          });
          const result = await Promise.race([
            provider.generate({ ...req, signal }),
            timeout,
          ]);
          this.success(provider);
          this.log({
            provider: provider.name,
            model: result.model,
            latencyMs: Date.now() - started,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            success: true,
          });
          return result;
        } catch {
          this.log({
            provider: provider.name,
            model: "unknown",
            latencyMs: Date.now() - started,
            success: false,
          });
        } finally {
          if (timer) clearTimeout(timer);
          controller.abort();
        }
      }
      this.failure(provider);
    }
    throw new Error("No AI provider is available");
  }
  /** Stream from the first working provider; never mix providers after output has begun. */
  async *stream(req: LLMRequest): AsyncIterable<string> {
    for (const provider of this.providers) {
      if (!this.enabled(provider)) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (req.signal?.aborted) throw new Error("Generation cancelled");
        const started = Date.now();
        const controller = new AbortController();
        const signal = req.signal
          ? AbortSignal.any([req.signal, controller.signal])
          : controller.signal;
        const stream = provider.stream({ ...req, signal });
        const iterator = stream[Symbol.asyncIterator]();
        let emitted = false;
        try {
          while (true) {
            const remaining = Math.max(
              0,
              (this.options.timeoutMs ?? 15000) - (Date.now() - started),
            );
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                  controller.abort();
                  reject(new Error("AI provider timed out"));
                }, remaining);
              });
              const next = await Promise.race([iterator.next(), timeout]);
              if (timer) {
                clearTimeout(timer);
                timer = undefined;
              }
              if (next.done) break;
              if (next.value) {
                emitted = true;
                yield next.value;
              }
            } finally {
              if (timer) clearTimeout(timer);
            }
          }
          if (!emitted) throw new Error("Empty provider stream");
          this.success(provider);
          this.log({
            provider: provider.name,
            model: "stream",
            latencyMs: Date.now() - started,
            success: true,
          });
          return;
        } catch {
          this.log({
            provider: provider.name,
            model: "stream",
            latencyMs: Date.now() - started,
            success: false,
          });
          if (emitted) {
            this.failure(provider);
            throw new Error("AI stream interrupted");
          }
        } finally {
          controller.abort();
          void iterator.return?.().catch(() => undefined);
        }
      }
      this.failure(provider);
    }
    throw new Error("No AI provider is available");
  }
}
