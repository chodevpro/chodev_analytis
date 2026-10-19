/**
 * @chodev/analytics
 * Official Cross-Platform Analytics & Remote Config SDK for Web and React Native.
 */

export * from './core/types';
export * from './core/config';
export * from './core/storage';
export * from './core/transport';
export * from './core/privacy';
export * from './core/client';

export {
  WebAnalyticsClient,
  ChoDevWebAnalytics,
  init,
  pageview,
  track,
  optOut,
  optIn,
  isOptedOut,
} from './web/index';
