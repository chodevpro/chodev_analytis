import { AnalyticsEventPayload, EventType, PlatformType } from './types';
import { NormalizedConfig } from './config';
import { PrivacyManager } from './privacy';

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
    const sanitizedData = this.config.sanitizeProperties
      ? this.privacy.sanitizeData(properties)
      : properties || null;

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
    };
  }
}
