import { AnalyticsEventPayload, ITransport } from './types';
import { logDebug, logWarn } from './config';

export class FetchTransport implements ITransport {
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  public async send(endpoint: string, payload: AnalyticsEventPayload, timeoutMs = 5000): Promise<boolean> {
    try {
      if (typeof fetch === 'undefined') {
        logWarn('Global fetch is not available in this environment. Telemetry cannot be sent.');
        return false;
      }

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        body,
        // @ts-ignore - keepalive is supported in modern browsers
        keepalive: true,
      };

      if (controller) {
        fetchOptions.signal = controller.signal;
      }

      const response = await fetch(endpoint, fetchOptions);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        logDebug(this.debug, `Server responded with status ${response.status} ${response.statusText}`);
        return false;
      }

      logDebug(this.debug, 'Event delivered successfully:', payload.type, payload.event || payload.path || payload.screen);
      return true;
    } catch (err: any) {
      // Analytics should NEVER crash host application
      logDebug(this.debug, 'Network transport error sending event:', err?.message || err);
      return false;
    }
  }
}
