/**
 * Web URL Cleaner:
 * Sanitizes URLs to extract path, referrer, and allowed UTM parameters
 * while completely stripping out tokens, session IDs, emails, or personal parameters.
 */

const ALLOWED_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
]);

export function cleanPathAndQuery(rawUrl?: string): string {
  if (typeof window === 'undefined' && !rawUrl) {
    return '/';
  }

  try {
    const url = new URL(rawUrl || window.location.href, 'https://localhost');
    const pathname = url.pathname || '/';

    const cleanParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (ALLOWED_QUERY_PARAMS.has(lowerKey)) {
        cleanParams.append(lowerKey, value.substring(0, 100));
      }
    }

    const queryString = cleanParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  } catch {
    return rawUrl ? rawUrl.split('?')[0] : '/';
  }
}

export function cleanReferrer(rawReferrer?: string): string | null {
  const ref = rawReferrer !== undefined ? rawReferrer : (typeof document !== 'undefined' ? document.referrer : '');
  if (!ref) return null;

  try {
    const url = new URL(ref);
    // Return hostname or origin without sensitive query strings
    return url.hostname || url.origin;
  } catch {
    return ref.substring(0, 100);
  }
}
