/**
 * Webhook notification system.
 *
 * Sends POST requests to registered webhook URLs when collaboration
 * events occur. Includes retry logic with exponential backoff.
 */

import type { CollabEvent } from "./types.js";
import { CollabEventEmitter } from "./events.js";

export interface WebhookConfig {
  url: string;
  secret: string;
  events: CollabEvent["type"][] | "*";
  maxRetries: number;
  retryDelayMs: number;
}

export class WebhookManager {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private unsubscribers: Array<() => void> = [];

  constructor(private emitter: CollabEventEmitter) {}

  /**
   * Register a webhook endpoint.
   */
  register(id: string, config: WebhookConfig): void {
    this.webhooks.set(id, config);

    const unsub = config.events === "*"
      ? this.emitter.onAll((event) => this.deliver(config, event))
      : (() => {
          const unsubs = (config.events as CollabEvent["type"][]).map((type) =>
            this.emitter.on(type, (event) => this.deliver(config, event)),
          );
          return () => unsubs.forEach((u) => u());
        })();

    this.unsubscribers.push(unsub);
  }

  /**
   * Remove a webhook registration.
   */
  unregister(id: string): boolean {
    return this.webhooks.delete(id);
  }

  /**
   * List all registered webhooks.
   */
  list(): Array<{ id: string; url: string; events: string[] | "*" }> {
    return Array.from(this.webhooks.entries()).map(([id, config]) => ({
      id,
      url: config.url,
      events: config.events,
    }));
  }

  /**
   * Deliver an event to a webhook with retry logic.
   */
  private async deliver(config: WebhookConfig, event: CollabEvent): Promise<void> {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
    });

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const response = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Secret": config.secret,
            "X-Webhook-Event": event.type,
            "X-Webhook-Attempt": String(attempt + 1),
          },
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) {
          return;
        }

        console.warn(
          `[webhook] ${config.url} returned ${response.status} (attempt ${attempt + 1})`,
        );
      } catch (err) {
        console.warn(
          `[webhook] ${config.url} failed (attempt ${attempt + 1}):`,
          err instanceof Error ? err.message : err,
        );
      }

      // Exponential backoff before retry
      if (attempt < config.maxRetries) {
        const delay = config.retryDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error(`[webhook] ${config.url} — all ${config.maxRetries + 1} attempts failed`);
  }

  /**
   * Cleanup all subscriptions.
   */
  destroy(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.webhooks.clear();
  }
}
