// Small typed observer bus for decoupled application events.
/** Events exposed to application subscribers. */
export interface AppEvents {
  "interview.completed": { interviewId: string; userId: string };
}
type Handler<T> = (payload: T) => void | Promise<void>;
/** Publish and subscribe to typed application events. */
export class EventBus {
  private readonly handlers = new Map<keyof AppEvents, Set<Handler<never>>>();
  /** Subscribe to an event and return an unsubscribe function. */
  subscribe<K extends keyof AppEvents>(
    event: K,
    handler: Handler<AppEvents[K]>,
  ): () => void {
    const handlers = this.handlers.get(event) ?? new Set<Handler<never>>();
    handlers.add(handler as Handler<never>);
    this.handlers.set(event, handlers);
    return () => {
      handlers.delete(handler as Handler<never>);
    };
  }
  /** Wait for all subscribed handlers; callers decide how to handle failures. */
  async publish<K extends keyof AppEvents>(
    event: K,
    payload: AppEvents[K],
  ): Promise<void> {
    await Promise.all(
      Array.from(this.handlers.get(event) ?? [], (handler) =>
        handler(payload as never),
      ),
    );
  }
}
