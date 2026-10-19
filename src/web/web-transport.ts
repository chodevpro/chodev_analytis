import { AnalyticsEventPayload, ITransport } from '../core/types';
import { FetchTransport } from '../core/transport';
import { logDebug } from '../core/config';

/**
 * Web transport with honest delivery semantics:
 *
 * - While the page is visible, `fetch` is used FIRST so we observe the real HTTP
 *   status. `sendBeacon` alone can never prove persistence - it only reports that
 *   the browser queued the request, so it must not be the primary channel.
 * - When the page is hidden / unloading, `sendBeacon` is preferred because the
 *   browser guarantees the request survives page teardown.
 * - If `fetch` fails (offline, timeout, network error) while the page is visible,
 *   `sendBeacon` is attempted as a last resort.
 */
export class WebTransport implements ITransport {
  private fallbackTransport: FetchTransport;
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
    this.fallbackTransport = new FetchTransport(debug);
  }

  public async send(endpoint: string, payload: AnalyticsEventPayload, timeoutMs = 5000): Promise<boolean> {
    const pageHidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden';

    // Unloading page: beacon is the only channel that survives teardown.
    if (pageHidden && this.trySendBeacon(endpoint, payload)) {
      return true;
    }

    // Primary path: fetch with real status verification.
    if (await this.fallbackTransport.send(endpoint, payload, timeoutMs)) {
      return true;
    }

    // fetch failed while the page is still visible: last-resort beacon attempt.
    if (!pageHidden && this.trySendBeacon(endpoint, payload)) {
      return true;
    }

    return false;
  }

  private trySendBeacon(endpoint: string, payload: AnalyticsEventPayload): boolean {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      typeof navigator.sendBeacon !== 'function'
    ) {
      return false;
    }

    try {
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: 'application/json' });
      const accepted = navigator.sendBeacon(endpoint, blob);
      logDebug(
        this.debug,
        accepted
          ? 'Event queued via navigator.sendBeacon (delivery confirmed by browser queue only).'
          : 'navigator.sendBeacon rejected the payload (queue full or invalid).'
      );
      return accepted;
    } catch (err: any) {
      logDebug(this.debug, 'sendBeacon failed:', err?.message || err);
      return false;
    }
  }
}
