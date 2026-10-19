import { IStorage } from './types';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /bearer/i,
  /api[-_]?key/i,
  /credit[-_]?card/i,
  /cvv/i,
  /ssn/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
  /auth[-_]?header/i,
];

const OPT_OUT_STORAGE_KEY = '__chodev_opt_out';

export class PrivacyManager {
  private _isOptedOut = false;
  private storage?: IStorage;

  constructor(storage?: IStorage) {
    this.storage = storage;
    if (this.storage) {
      try {
        const val = this.storage.getItem(OPT_OUT_STORAGE_KEY);
        if (typeof val === 'string') {
          this._isOptedOut = val === '1' || val === 'true';
        }
      } catch {
        // Fallback silently if storage unavailable
      }
    }
  }

  public isOptedOut(): boolean {
    return this._isOptedOut;
  }

  public optOut(): void {
    this._isOptedOut = true;
    if (this.storage) {
      try {
        this.storage.setItem(OPT_OUT_STORAGE_KEY, '1');
      } catch {}
    }
  }

  public optIn(): void {
    this._isOptedOut = false;
    if (this.storage) {
      try {
        this.storage.removeItem(OPT_OUT_STORAGE_KEY);
      } catch {}
    }
  }

  public sanitizeData(data?: Record<string, any> | null): Record<string, any> | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const clean: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // Check if key contains sensitive terms
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        clean[key] = '[REDACTED]';
        continue;
      }

      // Check values recursively or truncate huge strings
      if (typeof value === 'string') {
        clean[key] = value.length > 500 ? value.substring(0, 500) + '...' : value;
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          clean[key] = value.slice(0, 50);
        } else {
          clean[key] = this.sanitizeData(value);
        }
      } else {
        clean[key] = value;
      }
    }

    return clean;
  }
}
