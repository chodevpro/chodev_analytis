import { AnalyticsConfig } from './types';

export const DEFAULT_ENDPOINT = 'https://chodev.pro/api/analytics/collect';
export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_MAX_QUEUE_SIZE = 50;

export interface NormalizedConfig {
  siteId: string;
  endpoint: string;
  platform: 'web' | 'ios' | 'android' | 'cross_platform';
  appVersion: string;
  debug: boolean;
  autoPageview: boolean;
  timeoutMs: number;
  maxQueueSize: number;
  sanitizeProperties: boolean;
  customHeaders: Record<string, string>;
}

export function validateAndNormalizeConfig(options: Partial<AnalyticsConfig>): NormalizedConfig {
  const siteId = (options.siteId || options.appId || '').trim();

  if (!siteId) {
    throw new Error('[@chodev/analytics] siteId or appId is required for initialization.');
  }

  let endpoint = (options.endpoint || DEFAULT_ENDPOINT).trim();
  if (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1);
  }

  // Ensure endpoint is a valid URL
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new Error(`[@chodev/analytics] Invalid endpoint URL provided: "${endpoint}"`);
  }

  return {
    siteId,
    endpoint,
    platform: options.platform || 'web',
    appVersion: options.appVersion || '1.0.0',
    debug: !!options.debug,
    autoPageview: options.autoPageview !== false,
    timeoutMs: options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS,
    maxQueueSize: options.maxQueueSize && options.maxQueueSize > 0 ? options.maxQueueSize : DEFAULT_MAX_QUEUE_SIZE,
    sanitizeProperties: options.sanitizeProperties !== false,
    customHeaders: options.customHeaders || {},
  };
}

export function logDebug(enabled: boolean, message: string, ...args: any[]) {
  if (enabled && typeof console !== 'undefined' && console.log) {
    console.log(`[ChoDev Analytics] ${message}`, ...args);
  }
}

export function logWarn(message: string, ...args: any[]) {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[ChoDev Analytics Warning] ${message}`, ...args);
  }
}
