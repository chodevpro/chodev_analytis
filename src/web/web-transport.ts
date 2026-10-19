import { AnalyticsEventPayload, ITransport } from '../core/types';
import { FetchTransport } from '../core/transport';
import { logDebug } from '../core/config';

export class WebTransport implements ITransport {
  private fallbackTransport: FetchTransport;
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
    this.fallbackTransport = new FetchTransport(debug);
  }

  public async send(endpoint: string, payload: AnalyticsEventPayload, timeoutMs = 5000): Promise<boolean> {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const body = JSON.stringify(payload);
        const blob = new Blob([body], { type: 'application/json' });
        const success = navigator.sendBeacon(endpoint, blob);

        if (success) {
          logDebug(this.debug, 'Event successfully transmitted via navigator.sendBeacon');
          return true;
        }
      } catch (err: any) {
        logDebug(this.debug, 'sendBeacon failed, falling back to fetch:', err?.message || err);
      }
    }

    return this.fallbackTransport.send(endpoint, payload, timeoutMs);
  }
}
