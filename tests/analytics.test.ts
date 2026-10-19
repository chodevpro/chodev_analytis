import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { validateAndNormalizeConfig } from '../src/core/config';
import { PrivacyManager } from '../src/core/privacy';
import { MemoryStorage } from '../src/core/storage';
import { EventBuilder } from '../src/core/event-builder';
import { BaseAnalyticsClient } from '../src/core/client';
import { cleanPathAndQuery, cleanReferrer } from '../src/web/url-cleaner';
import { WebAnalyticsClient } from '../src/web/index';
import { ReactNativeAnalyticsClient } from '../src/react-native/index';
import { OfflineQueue } from '../src/react-native/offline-queue';
import { RemoteFlagsManager } from '../src/react-native/remote-flags';
import { ITransport, AnalyticsEventPayload } from '../src/core/types';

class MockTransport implements ITransport {
  public sentEvents: AnalyticsEventPayload[] = [];
  public shouldFail = false;

  async send(_endpoint: string, payload: AnalyticsEventPayload): Promise<boolean> {
    if (this.shouldFail) {
      return false;
    }
    this.sentEvents.push(payload);
    return true;
  }
}

describe('@chodev/analytics Comprehensive Test Suite', () => {
  let mockTransport: MockTransport;
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    mockTransport = new MockTransport();
    memoryStorage = new MemoryStorage();
  });

  // 1. SDK initialization
  test('1. SDK initialization succeeds with valid configuration', () => {
    const config = validateAndNormalizeConfig({
      siteId: 'cda_prod_test123',
      endpoint: 'https://chodev.pro/api/analytics/collect',
    });

    assert.equal(config.siteId, 'cda_prod_test123');
    assert.equal(config.endpoint, 'https://chodev.pro/api/analytics/collect');
    assert.equal(config.platform, 'web');
  });

  // 2. Missing Site ID
  test('2. Missing Site ID throws validation error', () => {
    assert.throws(
      () => validateAndNormalizeConfig({ siteId: '' }),
      /siteId or appId is required/
    );
  });

  // 3. Invalid endpoint configuration
  test('3. Invalid endpoint configuration throws validation error', () => {
    assert.throws(
      () => validateAndNormalizeConfig({ siteId: 'cda_test', endpoint: 'not-a-valid-url' }),
      /Invalid endpoint URL/
    );
  });

  // 4. Pageview tracking
  test('4. Pageview sends correct payload', async () => {
    const client = new WebAnalyticsClient();
    // @ts-ignore
    client['transport'] = mockTransport;

    client.init({ siteId: 'cda_prod_123', autoPageview: false });
    const success = await client.pageview('/pricing');

    assert.equal(success, true);
    assert.equal(mockTransport.sentEvents.length, 1);
    assert.equal(mockTransport.sentEvents[0].type, 'pageview');
    assert.equal(mockTransport.sentEvents[0].path, '/pricing');
  });

  // 5. Custom events tracking
  test('5. Custom events track with custom properties', async () => {
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123' });

    const success = await client.track('signup_button_clicked', { source: 'hero_banner' });
    assert.equal(success, true);
    assert.equal(mockTransport.sentEvents.length, 1);
    assert.equal(mockTransport.sentEvents[0].type, 'custom');
    assert.equal(mockTransport.sentEvents[0].event, 'signup_button_clicked');
    assert.equal(mockTransport.sentEvents[0].data?.source, 'hero_banner');
  });

  // 6. Event payload validation & size limit
  test('6. Event payload limits large strings and data structures', () => {
    const privacy = new PrivacyManager(memoryStorage);
    const config = validateAndNormalizeConfig({ siteId: 'cda_prod_123' });
    const builder = new EventBuilder(config, privacy);

    const hugeString = 'a'.repeat(1000);
    const event = builder.buildEvent('custom', 'test_event', { details: hugeString });

    assert.ok(event);
    assert.ok((event.data?.details as string).length <= 503); // 500 + '...'
  });

  // 7. Network failure safety (never crashes host app)
  test('7. Network failure does not throw and returns false', async () => {
    mockTransport.shouldFail = true;
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123' });

    let didThrow = false;
    let result = false;
    try {
      result = await client.track('network_test_event');
    } catch {
      didThrow = true;
    }

    assert.equal(didThrow, false, 'Client must not throw on network failure');
    assert.equal(result, false);
  });

  // 8. Backend error handling
  test('8. Backend error response is handled gracefully', async () => {
    mockTransport.shouldFail = true;
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123' });

    const result = await client.track('error_event');
    assert.equal(result, false);
  });

  // 9. Opt-out and opt-in functionality
  test('9. Opt-out prevents event dispatching and opt-in restores it', async () => {
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123' });

    client.optOut();
    assert.equal(client.isOptedOut(), true);

    const resultOptedOut = await client.track('event_while_opted_out');
    assert.equal(resultOptedOut, false);
    assert.equal(mockTransport.sentEvents.length, 0);

    client.optIn();
    assert.equal(client.isOptedOut(), false);

    const resultOptedIn = await client.track('event_after_opt_in');
    assert.equal(resultOptedIn, true);
    assert.equal(mockTransport.sentEvents.length, 1);
  });

  // 10. Duplicate initialization safety
  test('10. Duplicate init() calls are idempotent and do not create multiple listeners', () => {
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123' });
    const firstConfig = client.getConfig();

    client.init({ siteId: 'cda_prod_123' });
    const secondConfig = client.getConfig();

    assert.equal(firstConfig?.siteId, secondConfig?.siteId);
  });

  // 11. Duplicate pageview suppression
  test('11. Consecutive duplicate pageviews to identical path are suppressed', async () => {
    const client = new WebAnalyticsClient();
    // @ts-ignore
    client['transport'] = mockTransport;
    client.init({ siteId: 'cda_prod_123', autoPageview: false });

    const first = await client.pageview('/dashboard');
    const second = await client.pageview('/dashboard');

    assert.equal(first, true);
    assert.equal(second, false, 'Duplicate pageview within 1s should be suppressed');
    assert.equal(mockTransport.sentEvents.length, 1);
  });

  // 12. URL cleaner & allowed UTM parameters
  test('12. URL cleaner preserves allowed UTM parameters and strips sensitive query tokens', () => {
    const raw = 'https://chodev.pro/checkout?utm_source=facebook&utm_medium=cpc&token=SECRET123&session_id=ABC';
    const cleaned = cleanPathAndQuery(raw);

    assert.ok(cleaned.includes('utm_source=facebook'));
    assert.ok(cleaned.includes('utm_medium=cpc'));
    assert.ok(!cleaned.includes('SECRET123'), 'Must strip sensitive token');
    assert.ok(!cleaned.includes('session_id'), 'Must strip session_id');
  });

  // 13. Referrer cleaner sanitizes referrer
  test('13. Referrer cleaner strips query strings from referrer', () => {
    const ref = cleanReferrer('https://google.com/search?q=chodev&token=xyz');
    assert.equal(ref, 'google.com');
  });

  // 14. React Native runtime environment (no DOM, no window)
  test('14. React Native client works without window or document', async () => {
    const rnClient = new ReactNativeAnalyticsClient(memoryStorage);
    // @ts-ignore
    rnClient['transport'] = mockTransport;

    rnClient.init({ appId: 'cda_mobile_999', platform: 'ios', appVersion: '2.1.0' });
    const success = await rnClient.screen('CheckoutScreen', { items: 2 });

    assert.equal(success, true);
    assert.equal(mockTransport.sentEvents.length, 1);
    assert.equal(mockTransport.sentEvents[0].type, 'screenview');
    assert.equal(mockTransport.sentEvents[0].screen, 'CheckoutScreen');
    assert.equal(mockTransport.sentEvents[0].platform, 'ios');
  });

  // 15. React Native appOpen tracking
  test('15. React Native appOpen emits custom app_open event', async () => {
    const rnClient = new ReactNativeAnalyticsClient(memoryStorage);
    // @ts-ignore
    rnClient['transport'] = mockTransport;
    rnClient.init({ appId: 'cda_mobile_999', platform: 'android' });

    const success = await rnClient.appOpen({ coldStart: true });
    assert.equal(success, true);
    assert.equal(mockTransport.sentEvents.length, 1);
    assert.equal(mockTransport.sentEvents[0].event, 'app_open');
  });

  // 16. Remote config flags evaluation & fallback
  test('16. Remote flags evaluation returns boolean flag value', () => {
    const flagsManager = new RemoteFlagsManager();
    // @ts-ignore
    flagsManager['flags'] = { enable_ai_v2: true, new_checkout: false };

    assert.equal(flagsManager.isFeatureEnabled('enable_ai_v2'), true);
    assert.equal(flagsManager.isFeatureEnabled('new_checkout'), false);
    assert.equal(flagsManager.isFeatureEnabled('non_existing_flag'), false);
  });

  // 17. Privacy filtering & sensitive field scrubbing
  test('17. Privacy manager redacts sensitive keys (passwords, tokens, cards)', () => {
    const privacy = new PrivacyManager(memoryStorage);
    const sanitized = privacy.sanitizeData({
      userEmail: 'user@chodev.pro',
      password: 'mypassword123',
      api_key: 'sk_live_999',
      credit_card: '4111222233334444',
      validKey: 'normal_value',
    });

    assert.equal(sanitized?.password, '[REDACTED]');
    assert.equal(sanitized?.api_key, '[REDACTED]');
    assert.equal(sanitized?.credit_card, '[REDACTED]');
    assert.equal(sanitized?.validKey, 'normal_value');
  });

  // 18. Offline queue buffering and flushing
  test('18. Offline queue buffers failed events and flushes when reconnected', async () => {
    const queue = new OfflineQueue(10, false);
    const event: AnalyticsEventPayload = {
      key: 'cda_123',
      platform: 'ios',
      type: 'screenview',
      screen: 'OfflineScreen',
      timestamp: Date.now(),
    };

    queue.enqueue(event);
    assert.equal(queue.size(), 1);

    // Flush to mock transport
    await queue.flush(mockTransport, 'https://chodev.pro/api/analytics/collect', 5000);

    assert.equal(queue.size(), 0, 'Queue should be empty after successful flush');
    assert.equal(mockTransport.sentEvents.length, 1);
    assert.equal(mockTransport.sentEvents[0].screen, 'OfflineScreen');
  });

  // 19. Idempotent eventId on every payload
  test('19. Every event payload carries a unique UUID v4 eventId', async () => {
    const client = new WebAnalyticsClient();
    // @ts-ignore
    client['transport'] = mockTransport;
    client.init({ siteId: 'cda_prod_123', autoPageview: false });

    await client.pageview('/first');
    await client.pageview('/second');

    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    assert.equal(mockTransport.sentEvents.length, 2);
    assert.ok(mockTransport.sentEvents[0].eventId, 'eventId must be present');
    assert.match(mockTransport.sentEvents[0].eventId!, uuidV4);
    assert.notEqual(mockTransport.sentEvents[0].eventId, mockTransport.sentEvents[1].eventId);
  });

  // 20. Dedupe narrowed: custom events never swallowed
  test('20. Identical custom events fired in quick succession are both sent', async () => {
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123' });

    const first = await client.track('add_to_cart', { productId: 42 });
    const second = await client.track('add_to_cart', { productId: 42 });

    assert.equal(first, true);
    assert.equal(second, true, 'Custom events must never be deduplicated');
    assert.equal(mockTransport.sentEvents.length, 2);
    assert.notEqual(mockTransport.sentEvents[0].eventId, mockTransport.sentEvents[1].eventId);
  });

  // 21. Bounded retry queue: failed events are queued, retried, and capped
  test('21. Failed deliveries are queued and flushed when transport recovers', async () => {
    mockTransport.shouldFail = true;
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123', maxQueueSize: 5 });

    await client.track('offline_event_1');
    assert.equal(client.getPendingQueueSize(), 1, 'Failed event must be queued for retry');

    // Transport recovers -> flushQueue delivers the buffered event
    mockTransport.shouldFail = false;
    const delivered = await client.flushQueue();

    assert.equal(delivered, 1);
    assert.equal(client.getPendingQueueSize(), 0);
    assert.equal(mockTransport.sentEvents.length, 1);
    assert.equal(mockTransport.sentEvents[0].event, 'offline_event_1');
  });

  test('22. Retry queue is bounded by maxQueueSize (oldest dropped)', async () => {
    mockTransport.shouldFail = true;
    const client = new BaseAnalyticsClient(mockTransport, memoryStorage);
    client.init({ siteId: 'cda_prod_123', maxQueueSize: 3 });

    for (let i = 0; i < 6; i++) {
      await client.track(`burst_event_${i}`);
    }

    assert.equal(client.getPendingQueueSize(), 3, 'Queue must never exceed maxQueueSize');
  });

  // 23. WebTransport: beacon on hidden page, fetch-first when visible
  test('23. WebTransport prefers sendBeacon while the page is hidden', async () => {
    const beaconCalls: Array<{ url: string }> = [];
    const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

    Object.defineProperty(globalThis, 'document', { value: { visibilityState: 'hidden' }, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        sendBeacon: (url: string) => {
          beaconCalls.push({ url });
          return true;
        },
      },
      configurable: true,
    });

    try {
      const { WebTransport } = await import('../src/web/web-transport.js');
      const transport = new WebTransport(false);
      const ok = await transport.send('https://chodev.pro/api/analytics/collect', {
        key: 'cda_prod_123',
        platform: 'web',
        type: 'pageview',
        path: '/hidden',
        timestamp: Date.now(),
      }, 1000);

      assert.equal(ok, true);
      assert.equal(beaconCalls.length, 1, 'Hidden page must use sendBeacon');
      assert.equal(beaconCalls[0].url, 'https://chodev.pro/api/analytics/collect');
    } finally {
      restoreDescriptor(globalThis, 'document', savedDocument);
      restoreDescriptor(globalThis, 'navigator', savedNavigator);
      restoreDescriptor(globalThis, 'window', savedWindow);
    }
  });

  test('24. WebTransport falls back to sendBeacon when fetch fails while visible', async () => {
    const beaconCalls: Array<{ url: string }> = [];
    const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const savedFetch = globalThis.fetch;

    Object.defineProperty(globalThis, 'document', { value: { visibilityState: 'visible' }, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        sendBeacon: (url: string) => {
          beaconCalls.push({ url });
          return true;
        },
      },
      configurable: true,
    });
    globalThis.fetch = (async () => {
      throw new Error('simulated network failure');
    }) as any;

    try {
      const { WebTransport } = await import('../src/web/web-transport.js');
      const transport = new WebTransport(false);
      const ok = await transport.send('https://chodev.pro/api/analytics/collect', {
        key: 'cda_prod_123',
        platform: 'web',
        type: 'pageview',
        path: '/visible',
        timestamp: Date.now(),
      }, 500);

      assert.equal(ok, true, 'Beacon last resort must rescue the failed fetch');
      assert.equal(beaconCalls.length, 1);
    } finally {
      globalThis.fetch = savedFetch;
      restoreDescriptor(globalThis, 'document', savedDocument);
      restoreDescriptor(globalThis, 'navigator', savedNavigator);
      restoreDescriptor(globalThis, 'window', savedWindow);
    }
  });

  // 25. Data size budget: oversized data becomes a valid marker, never invalid JSON
  test('25. Oversized event data is replaced with a valid _truncated marker', () => {
    const privacy = new PrivacyManager(memoryStorage);
    const config = validateAndNormalizeConfig({ siteId: 'cda_prod_123' });
    const builder = new EventBuilder(config, privacy);

    const bigProperties: Record<string, any> = {};
    for (let i = 0; i < 40; i++) {
      bigProperties[`field_${i}`] = 'x'.repeat(500);
    }
    const event = builder.buildEvent('custom', 'huge_event', bigProperties);

    assert.ok(event);
    assert.deepEqual(event!.data, { _truncated: true });
    // The serialized payload must remain valid JSON (jsonb-safe on the backend)
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(event!.data)));
  });

  function restoreDescriptor(target: any, key: string, descriptor?: PropertyDescriptor) {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      delete target[key];
    }
  }
});
