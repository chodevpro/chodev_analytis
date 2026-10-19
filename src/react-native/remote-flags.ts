import { RemoteFlagsResponse } from '../core/types';
import { logDebug, logWarn } from '../core/config';

export class RemoteFlagsManager {
  private flags: Record<string, boolean> = {};
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  public async syncFlags(endpoint: string, trackingKey: string, platform: string, appVersion: string): Promise<Record<string, boolean>> {
    try {
      if (typeof fetch === 'undefined') return this.flags;

      // Calculate flags endpoint: replace /collect or /events with /flags, or append /flags
      let flagsUrl = endpoint.replace(/\/collect\/?$/, '/flags').replace(/\/events\/?$/, '/flags');
      if (!flagsUrl.endsWith('/flags')) {
        flagsUrl = flagsUrl + '/flags';
      }

      const url = `${flagsUrl}?key=${encodeURIComponent(trackingKey)}&platform=${encodeURIComponent(platform)}&appVersion=${encodeURIComponent(appVersion)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const json = await res.json() as RemoteFlagsResponse;
        this.flags = json.flags || {};
        logDebug(this.debug, 'Feature flags synchronized:', this.flags);
      }
    } catch (err: any) {
      logWarn('Failed to sync remote feature flags:', err?.message || err);
    }

    return this.flags;
  }

  public isFeatureEnabled(flagKey: string): boolean {
    return !!this.flags[flagKey];
  }

  public getFlags(): Readonly<Record<string, boolean>> {
    return this.flags;
  }
}
