// Registry-based factory for interview round strategies.
import type { InterviewRound } from "./interview-round.js";
/** Create rounds from registered constructors. */
export class RoundFactory {
  private readonly registry = new Map<string, new () => InterviewRound>();
  /** Register a strategy under a unique type. */
  register(type: string, ctor: new () => InterviewRound): void {
    if (this.registry.has(type))
      throw new Error(`Round already registered: ${type}`);
    this.registry.set(type, ctor);
  }
  /** Create a fresh registered round. */
  create(type: string): InterviewRound {
    const ctor = this.registry.get(type);
    if (!ctor) throw new Error(`Unknown interview round: ${type}`);
    return new ctor();
  }
}
