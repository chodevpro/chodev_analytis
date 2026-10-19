/**
 * @chodev/analytics core types
 * Pure TypeScript definitions with zero DOM / platform dependencies.
 */

export type PlatformType = 'web' | 'ios' | 'android' | 'cross_platform';
export type EventType = 'pageview' | 'screenview' | 'custom';

export interface AnalyticsConfig {
  /**
   * Unique site ID or App ID assigned to the project (e.g., cda_prod_9f8a2b3c)
   */
  siteId?: string;

  /**
   * Alternative alias for siteId
   */
  appId?: string;

  /**
   * Analytics Ingestion endpoint URL (default: https://chodev.pro/api/analytics/collect)
   */
  endpoint?: string;

  /**
   * Platform type (default: 'web' in web adapter, 'ios' | 'android' in mobile adapter)
   */
  platform?: PlatformType;

  /**
   * Application version (e.g. 1.2.0)
   */
  appVersion?: string;

  /**
   * Debug logging enabled
   */
  debug?: boolean;

  /**
   * Automatically track pageviews on route/history change (web only)
   */
  autoPageview?: boolean;

  /**
   * Request timeout in milliseconds (default: 5000)
   */
  timeoutMs?: number;

  /**
   * Max batch or queue size (default: 50)
   */
  maxQueueSize?: number;

  /**
   * Sensitive key sanitization filter
   */
  sanitizeProperties?: boolean;

  /**
   * Custom headers to include with requests
   */
  customHeaders?: Record<string, string>;
}

export interface AnalyticsEventPayload {
  key: string;
  platform: PlatformType;
  type: EventType;
  screen?: string | null;
  path?: string | null;
  referrer?: string | null;
  appVersion?: string | null;
  deviceType?: string | null;
  deviceModel?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  event?: string | null;
  data?: Record<string, any> | null;
  timestamp?: number;
}

export interface ITransport {
  send(endpoint: string, payload: AnalyticsEventPayload, timeoutMs?: number): Promise<boolean>;
}

export interface IStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface RemoteFlagsResponse {
  flags: Record<string, boolean>;
}
