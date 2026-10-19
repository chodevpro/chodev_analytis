import { BaseAnalyticsClient } from '../core/client';
import { AnalyticsConfig } from '../core/types';
import { LocalStorageAdapter } from '../core/storage';
import { WebTransport } from './web-transport';
import { cleanPathAndQuery, cleanReferrer } from './url-cleaner';
import { AutoPageviewTracker } from './auto-pageview';

export class WebAnalyticsClient extends BaseAnalyticsClient {
  private autoTracker?: AutoPageviewTracker;
  private lastPageviewPath = '';
  private lastPageviewTimestamp = 0;

  constructor() {
    super(new WebTransport(), new LocalStorageAdapter());
  }

  public override init(options: AnalyticsConfig): void {
    super.init({
      ...options,
      platform: 'web',
    });

    if (this.config && this.config.autoPageview && typeof window !== 'undefined') {
      this.autoTracker = new AutoPageviewTracker((newPath) => {
        this.pageview(newPath);
      });
      this.autoTracker.start();
    }
  }

  /**
   * Tracks a pageview with sanitized URL path and clean referrer.
   * Prevents accidental duplicate pageviews for identical path within 1 second.
   */
  public async pageview(customPath?: string, properties?: Record<string, any>): Promise<boolean> {
    if (!this.ensureInitialized('pageview')) return false;

    const path = cleanPathAndQuery(customPath);
    const now = Date.now();

    if (path === this.lastPageviewPath && now - this.lastPageviewTimestamp < 1000) {
      return false;
    }

    this.lastPageviewPath = path;
    this.lastPageviewTimestamp = now;

    const referrer = cleanReferrer();
    const payload = this.eventBuilder!.buildEvent('pageview', path, properties, 'web');
    if (!payload) return false;

    payload.referrer = referrer;
    return this.dispatch(payload);
  }
}

// Singleton instance for web usage
export const ChoDevWebAnalytics = new WebAnalyticsClient();

export const init = (options: AnalyticsConfig) => ChoDevWebAnalytics.init(options);
export const pageview = (path?: string, properties?: Record<string, any>) => ChoDevWebAnalytics.pageview(path, properties);
export const track = (eventName: string, properties?: Record<string, any>) => ChoDevWebAnalytics.track(eventName, properties);
export const optOut = () => ChoDevWebAnalytics.optOut();
export const optIn = () => ChoDevWebAnalytics.optIn();
export const isOptedOut = () => ChoDevWebAnalytics.isOptedOut();
