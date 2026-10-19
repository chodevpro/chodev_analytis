import { AnalyticsEventPayload, ITransport } from '../core/types';
import { logDebug } from '../core/config';

export class OfflineQueue {
  private queue: AnalyticsEventPayload[] = [];
  private maxQueueSize: number;
  private isFlushing = false;
  private debug: boolean;

  constructor(maxQueueSize = 50, debug = false) {
    this.maxQueueSize = maxQueueSize;
    this.debug = debug;
  }

  public enqueue(payload: AnalyticsEventPayload): void {
    if (this.queue.length >= this.maxQueueSize) {
      // Drop oldest event if capacity exceeded (FIFO)
      this.queue.shift();
    }
    this.queue.push(payload);
    logDebug(this.debug, `Enqueued offline event. Current queue size: ${this.queue.length}`);
  }

  public size(): number {
    return this.queue.length;
  }

  public async flush(transport: ITransport, endpoint: string, timeoutMs: number): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    this.isFlushing = true;
    logDebug(this.debug, `Flushing ${this.queue.length} buffered offline events...`);

    const itemsToProcess = [...this.queue];
    const remaining: AnalyticsEventPayload[] = [];

    for (const item of itemsToProcess) {
      try {
        const sent = await transport.send(endpoint, item, timeoutMs);
        if (!sent) {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    this.queue = remaining;
    this.isFlushing = false;
    logDebug(this.debug, `Flush completed. Remaining offline events: ${this.queue.length}`);
  }
}
