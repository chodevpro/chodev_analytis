import { AnalyticsConfig, AnalyticsEventPayload, IStorage, ITransport } from './types';
import { NormalizedConfig, validateAndNormalizeConfig, logDebug, logWarn } from './config';
import { PrivacyManager } from './privacy';
import { MemoryStorage } from './storage';
import { FetchTransport } from './transport';
import { EventBuilder } from './event-builder';

export class BaseAnalyticsClient {
  protected config?: NormalizedConfig;
  protected transport: ITransport;
  protected storage: IStorage;
  protected privacy: PrivacyManager;
  protected eventBuilder?: EventBuilder;

  // Deduplication cache: hash -> timestamp
  private recentEvents = new Map<string, number>();

  constructor(transport?: ITransport, storage?: IStorage) {
    this.storage = storage || new MemoryStorage();
    this.transport = transport || new FetchTransport();
    this.privacy = new PrivacyManager(this.storage);
  }

  public init(options: AnalyticsConfig): void {
    if (this.config) {
      if (this.config.siteId === (options.siteId || options.appId)) {
        logDebug(this.config.debug, 'SDK is already initialized with this siteId/appId. Skipping duplicate initialization.');
        return;
      }
      logWarn('Re-initializing SDK with a new configuration.');
    }

    try {
      this.config = validateAndNormalizeConfig(options);
      this.transport = this.transport || new FetchTransport(this.config.debug);
      this.eventBuilder = new EventBuilder(this.config, this.privacy);
      logDebug(this.config.debug, 'Initialized successfully for platform:', this.config.platform);
    } catch (err: any) {
      logWarn('Initialization error:', err?.message || err);
    }
  }

  public isInitialized(): boolean {
    return !!this.config && !!this.eventBuilder;
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

    try {
      return await this.transport.send(this.config!.endpoint, payload, this.config!.timeoutMs);
    } catch {
      return false;
    }
  }

  private isDuplicate(payload: AnalyticsEventPayload): boolean {
    const key = `${payload.type}:${payload.event || payload.path || payload.screen}:${JSON.stringify(payload.data || {})}`;
    const now = Date.now();
    const lastSent = this.recentEvents.get(key);

    // Prune stale cache entries
    if (this.recentEvents.size > 100) {
      for (const [k, timestamp] of this.recentEvents.entries()) {
        if (now - timestamp > 5000) {
          this.recentEvents.delete(k);
        }
      }
    }

    if (lastSent && now - lastSent < 1000) {
      return true;
    }

    this.recentEvents.set(key, now);
    return false;
  }

  protected ensureInitialized(action: string): boolean {
    if (!this.isInitialized()) {
      logWarn(`Cannot call ${action}() before init() is called.`);
      return false;
    }
    return true;
  }
}
