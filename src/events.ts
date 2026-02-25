/**
 * Event system for the collaboration tracker.
 *
 * Emits typed events when collaborations are created, updated, or when
 * participants join/leave. Consumers can subscribe to specific event
 * types or listen to all events.
 */

import type { CollabEvent } from "./types.js";

type EventHandler = (event: CollabEvent) => void;
type EventType = CollabEvent["type"];

export class CollabEventEmitter {
  private handlers: Map<EventType | "*", Set<EventHandler>> = new Map();
  private eventLog: Array<{ event: CollabEvent; timestamp: string }> = [];
  private maxLogSize: number;

  constructor(maxLogSize = 1000) {
    this.maxLogSize = maxLogSize;
  }

  /**
   * Subscribe to a specific event type.
   */
  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /**
   * Subscribe to all events.
   */
  onAll(handler: EventHandler): () => void {
    if (!this.handlers.has("*")) {
      this.handlers.set("*", new Set());
    }
    this.handlers.get("*")!.add(handler);

    return () => {
      this.handlers.get("*")?.delete(handler);
    };
  }

  /**
   * Emit an event to all matching subscribers.
   */
  emit(event: CollabEvent): void {
    // Log the event
    this.eventLog.push({ event, timestamp: new Date().toISOString() });
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[events] Handler error for ${event.type}:`, err);
        }
      }
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get("*");
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[events] Wildcard handler error:`, err);
        }
      }
    }
  }

  /**
   * Get recent events, optionally filtered by type.
   */
  getRecentEvents(type?: EventType, limit = 50): Array<{ event: CollabEvent; timestamp: string }> {
    let events = this.eventLog;
    if (type) {
      events = events.filter((e) => e.event.type === type);
    }
    return events.slice(-limit);
  }

  /**
   * Clear all handlers and event log.
   */
  clear(): void {
    this.handlers.clear();
    this.eventLog = [];
  }
}
