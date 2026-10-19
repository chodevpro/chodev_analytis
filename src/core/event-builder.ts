import { AnalyticsEventPayload, EventType, PlatformType } from './types';
import { NormalizedConfig } from './config';
import { PrivacyManager } from './privacy';

/**
 * Matches the backend ingestion limit (10000 chars). Oversized data is replaced
 * with a valid marker object - the backend jsonb column rejects invalid JSON,
 * so truncating raw JSON strings is strictly forbidden.
 */
const MAX_DATA_JSON_CHARS = 10000;

/**
 * Generates a UUID v4 identifier. Uses crypto.randomUUID when available
 * (secure contexts), with a Math.random fallback for older environments.
 */
function generateEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the manual UUID v4 generator
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class EventBuilder {
  private config: NormalizedConfig;
  private privacy: PrivacyManager;

  constructor(config: NormalizedConfig, privacy: PrivacyManager) {
    this.config = config;
    this.privacy = privacy;
  }

  public buildEvent(
    type: EventType,
    nameOrPath: string,
    properties?: Record<string, any> | null,
    overridePlatform?: PlatformType
  ): AnalyticsEventPayload | null {
    if (this.privacy.isOptedOut()) {
      return null;
    }

    const platform = overridePlatform || this.config.platform;
    let sanitizedData = this.config.sanitizeProperties
      ? this.privacy.sanitizeData(properties)
      : properties || null;

    // Enforce the ingestion data budget with a VALID JSON marker (never truncated JSON).
    if (sanitizedData) {
      try {
        if (JSON.stringify(sanitizedData).length > MAX_DATA_JSON_CHARS) {
          sanitizedData = { _truncated: true };
        }
      } catch {
        sanitizedData = { _unserializable: true };
      }
    }

    let path: string | null = null;
    let screen: string | null = null;
    let eventName: string | null = null;

    if (type === 'pageview') {
      path = nameOrPath ? nameOrPath.substring(0, 500) : '/';
    } else if (type === 'screenview') {
      screen = nameOrPath ? nameOrPath.substring(0, 500) : 'MainScreen';
    } else {
      eventName = nameOrPath ? nameOrPath.substring(0, 64) : 'custom_event';
    }

    return {
      key: this.config.siteId,
      platform,
      type,
      path,
      screen,
      event: eventName,
      data: sanitizedData,
      appVersion: this.config.appVersion,
      timestamp: Date.now(),
      eventId: generateEventId(),
    };
  }
}
