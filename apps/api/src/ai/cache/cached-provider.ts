// Bounded in-memory LRU decorator for non-streamed provider responses.
import { createHash } from "node:crypto";
import type { ILLMProvider, LLMRequest, LLMResponse } from "../types.js";
/** Cache successful completions in memory for a short, configurable period. */
export class CachedProvider implements ILLMProvider {
  private readonly cache = new Map<
    string,
    { value: LLMResponse; expires: number }
  >();
  /** Decorate a provider; cache storage is local to this instance. */
  constructor(
    private readonly inner: ILLMProvider,
    private readonly maxEntries = 100,
    private readonly ttlMs = 60000,
  ) {}
  /** Expose the underlying provider name. */
  get name() {
    return this.inner.name;
  }
  /** Delegate health checks. */
  isHealthy() {
    return this.inner.isHealthy();
  }
  /** Return a cached completion or call the underlying strategy. */
  async generate(req: LLMRequest) {
    if (req.signal?.aborted) throw new Error("Generation cancelled");
    if (!req.cacheScope) return this.inner.generate(req);
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          req.cacheScope,
          req.system,
          req.prompt,
          req.task,
          req.temperature,
        ]),
      )
      .digest("hex");
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return { ...cached.value };
    }
    this.cache.delete(key);
    const value = await this.inner.generate(req);
    if (this.maxEntries > 0) {
      this.cache.set(key, {
        value: { ...value },
        expires: Date.now() + this.ttlMs,
      });
      while (this.cache.size > this.maxEntries) {
        const oldest = this.cache.keys().next().value;
        if (oldest === undefined) break;
        this.cache.delete(oldest);
      }
    }
    return value;
  }
  /** Streams are delegated directly and are not cached. */
  stream(req: LLMRequest) {
    return this.inner.stream(req);
  }
}
