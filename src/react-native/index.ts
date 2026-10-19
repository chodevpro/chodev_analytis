import { BaseAnalyticsClient } from '../core/client';
import { AnalyticsConfig, AnalyticsEventPayload, IStorage } from '../core/types';
import { MemoryStorage, AsyncStorageAdapter } from '../core/storage';
import { FetchTransport } from '../core/transport';
import { OfflineQueue } from './offline-queue';
import { RemoteFlagsManager } from './remote-flags';

export class ReactNativeAnalyticsClient extends BaseAnalyticsClient {
  private offlineQueue: OfflineQueue;
  private flagsManager: RemoteFlagsManager;

  constructor(customStorage?: IStorage) {
    super(new FetchTransport(), customStorage || new MemoryStorage());
    this.offlineQueue = new OfflineQueue(50, false);
    this.flagsManager = new RemoteFlagsManager(false);
    // React Native owns a persistent offline queue - the base client's in-memory
    // retry queue is disabled to avoid double-buffering the same event.
    this.enableAutoRetry = false;
  }

  public override init(options: AnalyticsConfig): void {
    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const platform = options.platform || (isIOS ? 'ios' : 'android');

    super.init({
      ...options,
      platform,
    });

    this.offlineQueue = new OfflineQueue(this.config?.maxQueueSize || 50, this.config?.debug || false);
    this.flagsManager = new RemoteFlagsManager(this.config?.debug || false);

    // Initial flags synchronization
    this.syncFlags().catch(() => {});
  }

  /**
   * Tracks screen views on mobile (React Native / Expo)
   */
  public async screen(screenName: string, properties?: Record<string, any>): Promise<boolean> {
    if (!this.ensureInitialized('screen')) return false;

    const payload = this.eventBuilder!.buildEvent('screenview', screenName, properties);
    if (!payload) return false;

    return this.dispatchMobile(payload);
  }

  /**
   * Tracks app open lifecycle event
   */
  public async appOpen(properties?: Record<string, any>): Promise<boolean> {
    if (!this.ensureInitialized('appOpen')) return false;

    const payload = this.eventBuilder!.buildEvent('custom', 'app_open', properties);
    if (!payload) return false;

    return this.dispatchMobile(payload);
  }

  /**
   * Evaluates Remote Config feature flags
   */
  public isFeatureEnabled(flagKey: string): boolean {
    return this.flagsManager.isFeatureEnabled(flagKey);
  }

  /**
   * Synchronizes remote feature flags from Chợ Dev Remote Config server
   */
  public async syncFlags(): Promise<Record<string, boolean>> {
    if (!this.config) return {};
    return this.flagsManager.syncFlags(
      this.config.endpoint,
      this.config.siteId,
      this.config.platform,
      this.config.appVersion
    );
  }

  public getFlags(): Readonly<Record<string, boolean>> {
    return this.flagsManager.getFlags();
  }

  /**
   * Pluggable AsyncStorage support (pass AsyncStorage instance from @react-native-async-storage/async-storage)
   */
  public setAsyncStorage(asyncStorageInstance: any): void {
    this.storage = new AsyncStorageAdapter(asyncStorageInstance);
  }

  private async dispatchMobile(payload: AnalyticsEventPayload): Promise<boolean> {
    // Attempt to flush offline queue first
    await this.offlineQueue.flush(this.transport, this.config!.endpoint, this.config!.timeoutMs);

    const success = await this.dispatch(payload);
    if (!success) {
      // Buffer event to offline queue for later delivery
      this.offlineQueue.enqueue(payload);
    }

    return success;
  }
}

// Singleton instance for React Native usage
export const ChoDevMobileAnalytics = new ReactNativeAnalyticsClient();

export const init = (options: AnalyticsConfig) => ChoDevMobileAnalytics.init(options);
export const screen = (screenName: string, properties?: Record<string, any>) => ChoDevMobileAnalytics.screen(screenName, properties);
export const track = (eventName: string, properties?: Record<string, any>) => ChoDevMobileAnalytics.track(eventName, properties);
export const appOpen = (properties?: Record<string, any>) => ChoDevMobileAnalytics.appOpen(properties);
export const isFeatureEnabled = (flagKey: string) => ChoDevMobileAnalytics.isFeatureEnabled(flagKey);
export const syncFlags = () => ChoDevMobileAnalytics.syncFlags();
export const optOut = () => ChoDevMobileAnalytics.optOut();
export const optIn = () => ChoDevMobileAnalytics.optIn();
export const isOptedOut = () => ChoDevMobileAnalytics.isOptedOut();
