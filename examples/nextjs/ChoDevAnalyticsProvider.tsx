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
      autoPageview: false,
    });
  }, [siteId]);

  useEffect(() => {
    if (pathname) {
      pageview(pathname);
    }
  }, [pathname, searchParams]);

  return null;
}
