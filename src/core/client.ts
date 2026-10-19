import { AnalyticsConfig, AnalyticsEventPayload, IStorage, ITransport } from './types';
import { NormalizedConfig, validateAndNormalizeConfig, logDebug, logWarn } from './config';
import { PrivacyManager } from './privacy';
import { MemoryStorage } from './storage';
import { FetchTransport } from './transport';
import { EventBuilder } from './event-builder';

const RETRY_DELAY_MS = 5000;
/**
 * Queued events older than this are dropped. Together with maxQueueSize this
 * bounds both memory and retry effort; the backend also clamps stale timestamps.
 */
const MAX_QUEUE_AGE_MS = 5 * 60 * 1000;

interface QueuedEvent {
  payload: AnalyticsEventPayload;
  queuedAt: number;
}

export class BaseAnalyticsClient {
  protected config?: NormalizedConfig;
  protected transport: ITransport;
  protected storage: IStorage;
  protected privacy: PrivacyManager;
  protected eventBuilder?: EventBuilder;

  /**
   * When true, events that fail to deliver are buffered in a bounded in-memory
   * queue and retried (timer + 'online' event). React Native disables this
   * because it owns a persistent offline queue of its own.
   */
  protected enableAutoRetry = true;

  // Deduplication cache for automatic navigational events: key -> timestamp
  private recentEvents = new Map<string, number>();

  // Bounded retry queue for failed deliveries
  private failedQueue: QueuedEvent[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineListener: (() => void) | null = null;

  constructor(transport?: ITransport, storage?: IStorage) {
    this.storage = storage || new MemoryStorage();
    this.transport = transport || new FetchTransport();
    this.privacy = new PrivacyManager(this.storage);
  }

  public init(options: AnalyticsConfig): void {
    if (this.config) {
      if (this.config.siteId === (options.siteId || options.appId)) {
        logDebug(this.config.debug, 'Analytics already initialized for this site. Skipping re-init.');
        return;
      }
      logWarn('Analytics was already initialized for a different site. Overwriting config.');
    }

    try {
      this.config = validateAndNormalizeConfig(options);
      this.eventBuilder = new EventBuilder(this.config, this.privacy);
      logDebug(this.config.debug, 'Initialized successfully for platform:', this.config.platform);
    } catch (err: any) {
      // Keep the previous (working) config when a re-initialization attempt fails.
      logWarn('Initialization error:', err?.message || err);
    }
  }

  public optOut(): void {
    this.privacy.optOut();
  }

  public optIn(): void {
    this.privacy.optIn();
  }

  public isOptedOut(): boolean {
    return this.privacy.isOptedOut();
  }

  public getConfig(): Readonly<NormalizedConfig> | undefined {
    return this.config;
  }

  public isInitialized(): boolean {
    return !!this.config && !!this.eventBuilder;
  }

  public async track(eventName: string, properties?: Record<string, any>): Promise<boolean> {
    if (!this.ensureInitialized('track')) return false;

    const payload = this.eventBuilder!.buildEvent('custom', eventName, properties);
    if (!payload) return false;

    return this.dispatch(payload);
  }

  protected async dispatch(payload: AnalyticsEventPayload): Promise<boolean> {
    if (this.isDuplicate(payload)) {
      logDebug(this.config?.debug || false, 'Suppressed duplicate event:', payload.type, payload.event || payload.path || payload.screen);
      return false;
    }

    let sent = false;
    try {
      sent = await this.transport.send(this.config!.endpoint, payload, this.config!.timeoutMs);
    } catch {
      sent = false;
    }

    if (sent) {
      return true;
    }

    // Delivery failed: buffer for a bounded retry instead of silently dropping.
    // The backend deduplicates by eventId, so retries can never inflate metrics.
    this.enqueueForRetry(payload);
    return false;
  }

  private isDuplicate(payload: AnalyticsEventPayload): boolean {
    // Only automatic navigational events are deduplicated. Deliberate track()
    // calls are user intent and must never be swallowed, even when fired in
    // quick succession with identical properties.
    if (payload.type !== 'pageview' && payload.type !== 'screenview') {
      return false;
    }

    const key = `${payload.type}:${payload.path || payload.screen || ''}`;
    const now = Date.now();

    // Prune stale cache entries
    if (this.recentEvents.size > 100) {
      for (const [k, timestamp] of this.recentEvents.entries()) {
        if (now - timestamp > 5000) {
          this.recentEvents.delete(k);
        }
      }
    }

    const lastSent = this.recentEvents.get(key);
    if (lastSent && now - lastSent < 1000) {
      return true;
    }

    this.recentEvents.set(key, now);
    return false;
  }

  private enqueueForRetry(payload: AnalyticsEventPayload): void {
    if (!this.enableAutoRetry || !this.config) {
      return;
    }

    const maxQueueSize = this.config.maxQueueSize || 50;
    if (this.failedQueue.length >= maxQueueSize) {
      this.failedQueue.shift(); // keep the queue bounded: drop the oldest event
      logDebug(this.config.debug, 'Retry queue is full - dropped the oldest queued event.');
    }

    this.failedQueue.push({ payload, queuedAt: Date.now() });
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.failedQueue.length === 0 || !this.config) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flushQueue();
    }, RETRY_DELAY_MS);

    // Never keep Node.js processes / test runners alive for analytics retries
    const timer = this.retryTimer as any;
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }

    if (typeof window !== 'undefined' && !this.onlineListener) {
      this.onlineListener = () => {
        void this.flushQueue();
      };
      window.addEventListener('online', this.onlineListener);
    }
  }

  /**
   * Attempts to deliver every queued (previously failed) event.
   * Events that fail again stay queued (bounded by maxQueueSize and a 5-minute
   * age cap). Safe to call on 'online' or 'pagehide'.
   * Returns the number of events delivered.
   */
  public async flushQueue(): Promise<number> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (!this.config || this.failedQueue.length === 0) {
      this.detachOnlineListener();
      return 0;
    }

    // Age cap: drop events that are too stale to matter
    const cutoff = Date.now() - MAX_QUEUE_AGE_MS;
    this.failedQueue = this.failedQueue.filter((item) => item.queuedAt >= cutoff);

    const pending = this.failedQueue;
    this.failedQueue = [];
    const maxQueueSize = this.config.maxQueueSize || 50;

    let delivered = 0;
    for (const item of pending) {
      let sent = false;
      try {
        sent = await this.transport.send(this.config.endpoint, item.payload, this.config.timeoutMs);
      } catch {
        sent = false;
      }

      if (sent) {
        delivered++;
      } else if (this.failedQueue.length < maxQueueSize) {
        this.failedQueue.push(item);
      }
    }

    if (this.failedQueue.length > 0) {
      this.scheduleRetry();
    } else {
      this.detachOnlineListener();
    }

    logDebug(this.config.debug, `Queue flush finished: ${delivered} delivered, ${this.failedQueue.length} still queued.`);
    return delivered;
  }

  /**
   * Number of events currently waiting for a retry (mainly for tests/diagnostics).
   */
  public getPendingQueueSize(): number {
    return this.failedQueue.length;
  }

  private detachOnlineListener(): void {
    if (this.onlineListener && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
  }

  protected ensureInitialized(action: string): boolean {
    if (!this.isInitialized()) {
      logWarn(`Cannot call ${action}() before init() is called.`);
      return false;
    }
    return true;
  }
}
