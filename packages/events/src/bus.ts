import type { EventName, EventPayload, LoopForgeEventMap } from "./types.js"

type Handler<E extends EventName> = (payload: EventPayload<E>) => void | Promise<void>

type AnyHandler = (payload: unknown) => void | Promise<void>

export class EventBus {
  private readonly handlers = new Map<string, Set<AnyHandler>>()

  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event)
    if (!set) { set = new Set(); this.handlers.set(event, set) }
    set.add(handler as AnyHandler)
    return () => { set?.delete(handler as AnyHandler) }
  }

  once<E extends EventName>(event: E, handler: Handler<E>): void {
    const off = this.on(event, (payload) => {
      off()
      handler(payload)
    })
  }

  async emit<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    const set = this.handlers.get(event)
    if (!set || set.size === 0) return
    await Promise.all([...set].map((h) => h(payload)))
  }

  listenerCount(event: EventName): number {
    return this.handlers.get(event)?.size ?? 0
  }

  removeAll(event?: EventName): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
  }
}

/** Process-singleton bus — import this wherever you need to publish or subscribe. */
export const bus = new EventBus()

/** Re-export the type map so consumers don't need a separate import. */
export type { LoopForgeEventMap }
