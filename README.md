# @chodev/analytics

> 🚀 **Official Cross-Platform Analytics & Remote Config SDK for Website, React, Next.js, and React Native**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Size](https://img.shields.io/badge/Bundle%20Size-%3C%202KB-brightgreen.svg)](#)

---

## 📑 Mục Lục
1. [Giới thiệu](#1-giới-thiệu)
2. [Yêu cầu runtime](#2-yêu-cầu-runtime)
3. [Cài đặt](#3-cài-đặt)
4. [Khởi tạo](#4-khởi-tạo)
5. [Ví dụ Vanilla JavaScript](#5-ví-dụ-vanilla-javascript)
6. [Ví dụ TypeScript](#6-ví-dụ-typescript)
7. [Ví dụ Next.js (App Router & Pages Router)](#7-ví-dụ-nextjs-app-router)
8. [Ví dụ React SPA](#8-ví-dụ-react-spa)
9. [Ví dụ React Native & Expo](#9-ví-dụ-react-native--expo)
10. [Pageview & Screen Tracking](#10-pageview--screen-tracking)
11. [Custom Events](#11-custom-events)
12. [Cấu hình Endpoint tùy chỉnh](#12-cấu-hình-endpoint-tùy-chỉnh)
13. [Opt-out & Quyền đồng thuận (Consent)](#13-opt-out--quyền-đồng-thuận-consent)
14. [Quyền riêng tư (Zero-Cookie & Zero-IDFA)](#14-quyền-riêng-tư)
15. [Xử lý sự cố (Troubleshooting)](#15-xử-lý-sự-cố-troubleshooting)
16. [Xác minh kết nối (Check Installation)](#16-xác-minh-kết-nối-check-installation)
17. [Cách chạy Test](#17-cách-chạy-test)
18. [Cách Build Package](#18-cách-build-package)
19. [Versioning](#19-versioning)
20. [Quy trình Publish lên npm](#20-quy-trình-publish-lên-npm)

---

## 1. Giới thiệu

`@chodev/analytics` là bộ SDK đo lường phân tích đa nền tảng tối giản, hiệu năng cao và bảo vệ quyền riêng tư người dùng. SDK cung cấp giải pháp thống nhất cho cả **Website** và **Mobile Apps (React Native, Expo)**, kết nối trực tiếp với nền tảng Chợ Dev Analytics:

- 🟢 **Realtime Active Online**: Đo lường người dùng online tức thời chuẩn Vercel dark mode.
- ⚡ **Zero Blocking**: Xử lý gửi tin nền qua `navigator.sendBeacon` hoặc `fetch` không làm chậm ứng dụng.
- 🔒 **Privacy-First**: Zero-Cookie trên Web, Zero-IDFA trên Mobile. Tự động che giấu mật khẩu, token, và thông tin nhạy cảm.
- 📱 **Remote Config / Feature Flags**: Bật/tắt tính năng từ xa trên app mobile mà không cần chờ duyệt lại App Store / Google Play!
- 📶 **Offline Resilient Queue**: Tự động lưu trữ sự kiện khi mất mạng trên thiết bị di động và gửi lại khi có kết nối.

---

## 2. Yêu cầu runtime

- **Node.js**: >= 18.0.0
- **Trình duyệt**: Hỗ trợ mọi trình duyệt hiện đại (Chrome, Safari, Firefox, Edge).
- **React**: >= 16.8.0, tương thích React 18 & React 19.
- **Next.js**: Tương thích Next.js 13, 14, 15, 16 (App Router & Pages Router).
- **React Native / Expo**: Tương thích React Native >= 0.65 và mọi phiên bản Expo SDK.

---

## 3. Cài đặt

Cài đặt package thông qua package manager bạn đang sử dụng:

```bash
# npm
npm install @chodev/analytics

# pnpm
pnpm add @chodev/analytics

# yarn
yarn add @chodev/analytics
```

---

## 4. Khởi tạo

Mỗi dự án trên Chợ Dev Analytics sẽ được cấp một **Site ID** (cho Web) hoặc **App ID** (cho Mobile), ví dụ: `cda_prod_9f8a2b3c`.

```typescript
import { init } from '@chodev/analytics';

init({
  siteId: 'cda_prod_9f8a2b3c',
  // Tùy chọn cấu hình
  debug: false,
  autoPageview: true, // Tự động đo lường khi chuyển trang SPA
});
```

---

## 5. Ví dụ Vanilla JavaScript

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Website của tôi</title>
</head>
<body>
  <h1>Chào mừng đến với website!</h1>
  <button id="buyBtn">Mua ngay</button>

  <script type="module">
    import { init, pageview, track } from './node_modules/@chodev/analytics/dist/index.mjs';

    init({ siteId: 'cda_prod_9f8a2b3c' });
    pageview();

    document.getElementById('buyBtn').addEventListener('click', () => {
      track('click_buy_now', { productId: 'prod_123', price: 99000 });
    });
  </script>
</body>
</html>
```

*Hoặc sử dụng snippet script nhúng trực tiếp `<script defer src="https://chodev.pro/chodev-analytics.js" data-site-id="cda_prod_9f8a2b3c"></script>` mà không cần build tool.*

---

## 6. Ví dụ TypeScript

```typescript
import { init, track, pageview, AnalyticsConfig } from '@chodev/analytics';

const config: AnalyticsConfig = {
  siteId: 'cda_prod_9f8a2b3c',
  endpoint: 'https://chodev.pro/api/analytics/collect',
  debug: process.env.NODE_ENV === 'development',
};

init(config);
pageview();

track('signup_completed', {
  method: 'github',
  plan: 'pro',
});
```

---

## 7. Ví dụ Next.js (App Router)

Trong Next.js App Router, SDK chạy ở phía client. Hãy tạo một Client Component `ChoDevAnalyticsProvider.tsx`:

```tsx
// app/ChoDevAnalyticsProvider.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { init, pageview } from '@chodev/analytics';

export function ChoDevAnalyticsProvider({ siteId }: { siteId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    init({
      siteId,
      autoPageview: false, // Quản lý qua Next.js router
    });
  }, [siteId]);

  useEffect(() => {
    if (pathname) {
      pageview(pathname);
    }
  }, [pathname, searchParams]);

  return null;
}
```

Đặt vào `app/layout.tsx`:

```tsx
// app/layout.tsx
import { ChoDevAnalyticsProvider } from './ChoDevAnalyticsProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <ChoDevAnalyticsProvider siteId="cda_prod_9f8a2b3c" />
        {children}
      </body>
    </html>
  );
}
```

---

## 8. Ví dụ React SPA

```tsx
// src/App.tsx
import React, { useEffect } from 'react';
import { init, pageview, track } from '@chodev/analytics';

export default function App() {
  useEffect(() => {
    init({
      siteId: 'cda_prod_9f8a2b3c',
      autoPageview: true, // Tự động bắt thay đổi lịch sử pushState/replaceState
    });
    pageview();
  }, []);

  const handleSubscribe = () => {
    track('newsletter_subscribed', { topic: 'tech' });
  };

  return (
    <div>
      <h1>My React App</h1>
      <button onClick={handleSubscribe}>Đăng ký nhận tin</button>
    </div>
  );
}
```

---

## 9. Ví dụ React Native & Expo

Đối với React Native, sử dụng entry point `@chodev/analytics/react-native`:

```typescript
// App.tsx
import React, { useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import {
  init,
  screen,
  track,
  appOpen,
  isFeatureEnabled,
  syncFlags,
} from '@chodev/analytics/react-native';

export default function App() {
  useEffect(() => {
    // 1. Khởi tạo với App ID & phiên bản app
    init({
      appId: 'cda_prod_9f8a2b3c',
      appVersion: '1.2.0',
    });

    // 2. Ghi nhận mở app & theo dõi màn hình chính
    appOpen();
    screen('HomeScreen');

    // 3. Đồng bộ Feature Flags / Remote Config
    syncFlags();
  }, []);

  const handleCheckout = () => {
    track('checkout_started', { cartTotal: 250000 });
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Chợ Dev React Native Demo</Text>
      <Button title="Thanh toán" onPress={handleCheckout} />

      {/* 4. Remote Config: Bật/tắt tính năng từ xa */}
      {isFeatureEnabled('enable_ai_search') && (
        <Text>Tính năng Tìm kiếm AI đã được kích hoạt từ xa!</Text>
      )}
    </View>
  );
}
```

---

## 10. Pageview & Screen Tracking

- **Web (`pageview`)**:
  ```typescript
  import { pageview } from '@chodev/analytics';
  pageview('/pricing');
  ```
  Tự động thu thập URL pathname, referrer đã lọc và các tham số tiếp thị được cho phép (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`). Ngăn chặn duplicate pageview nếu gọi trùng lặp trong 1 giây.

- **Mobile (`screen`)**:
  ```typescript
  import { screen } from '@chodev/analytics/react-native';
  screen('PaymentModal', { source: 'banner' });
  ```

---

## 11. Custom Events

```typescript
import { track } from '@chodev/analytics';

track('order_completed', {
  orderId: 'ORD-9872',
  amount: 450000,
  currency: 'VND',
  itemCount: 3,
});
```

---

## 12. Cấu hình Endpoint tùy chỉnh

Nếu bạn tự host backend Chợ Dev hoặc sử dụng proxy riêng:

```typescript
init({
  siteId: 'cda_prod_9f8a2b3c',
  endpoint: 'https://your-custom-domain.com/api/analytics/collect',
});
```

---

## 13. Opt-out & Quyền đồng thuận (Consent)

Người dùng có thể từ chối theo dõi (Opt-out) bất cứ lúc nào. Khi đã opt-out, mọi lệnh `pageview`, `screen`, `track` đều bị chặn cục bộ trước khi gửi qua mạng:

```typescript
import { optOut, optIn, isOptedOut } from '@chodev/analytics';

// Người dùng chọn tắt theo dõi
optOut();
console.log(isOptedOut()); // true

// Người dùng đồng ý theo dõi lại
optIn();
```

---

## 14. Quyền riêng tư

SDK được thiết kế tuân thủ nghiêm ngặt các quy định bảo vệ dữ liệu (GDPR, CCPA):
1. **Zero Cookie**: Không lưu cookie theo dõi danh tính người dùng.
2. **Zero IDFA**: Không thu thập Advertising ID trên iOS, đảm bảo 100% không yêu cầu pop-up ATT gây phiền toái.
3. **Data Scrubbing**: Tự động thanh lọc các trường nhạy cảm như `password`, `token`, `secret`, `authorization`, `credit_card`.
4. **URL Sanitization**: Loại bỏ mọi token, auth code và query string nhạy cảm khỏi URL trước khi gửi về máy chủ.

---

## 15. Xử lý sự cố (Troubleshooting)

- **Lỗi `Cannot call pageview() before init() is called`**: Hãy đảm bảo gọi `init({ siteId: '...' })` trước khi gửi sự kiện.
- **Không thấy event trên Dashboard**:
  - Kiểm tra Site ID / App ID có khớp với dự án trên dashboard.
  - Kiểm tra xem bạn có đang ở chế độ `optOut()` hay không.
  - Bật cờ `debug: true` trong `init()` để xem log chi tiết trong console trình duyệt hoặc Metro bundler.
- **Lỗi SSR Next.js**: Đảm bảo đặt mã khởi tạo trong Client Component có chỉ thị `'use client'`.

---

## 16. Xác minh kết nối (Check Installation)

1. Tạo dự án trên Dashboard Chợ Dev tại `https://chodev.pro/analytics`.
2. Lấy Site ID / App ID (ví dụ: `cda_prod_xxx`).
3. Khởi tạo SDK trong code và chạy thử website/app.
4. Mở Dashboard và nhấn **Check Installation**.
5. Hệ thống sẽ tự động xác minh gói tin telemetry thực tế từ SDK và chuyển trạng thái sang **Connected 🟢**.

---

## 17. Cách chạy Test

Chạy bộ test chất lượng với TypeScript và Node Test Runner:

```bash
cd packages/analytics
npm test
```

---

## 18. Cách Build Package

```bash
cd packages/analytics
npm run build
```

Lệnh này sẽ biên dịch TypeScript, tạo types declaration `.d.ts` và tạo cả 2 định dạng ESM (`.mjs`) lẫn CommonJS (`.js`) trong thư mục `dist/`.

---

## 19. Versioning

Dự án tuân theo quy tắc Semantic Versioning (`MAJOR.MINOR.PATCH`):
- `1.0.0`: Bản phát hành chính thức hỗ trợ Web, Next.js, và React Native.

---

## 20. Quy trình Publish lên npm

Kiểm tra gói trước khi publish:

```bash
cd packages/analytics
npm pack --dry-run
```

Khi được sự đồng thuận của chủ sở hữu tổ chức:

```bash
npm login
npm publish --access public
```
