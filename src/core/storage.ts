import { IStorage } from './types';

/**
 * Pure In-Memory storage fallback, safe in any JavaScript runtime (Node, SSR, React Native, Browser)
 */
export class MemoryStorage implements IStorage {
  private _store = new Map<string, string>();

  public getItem(key: string): string | null {
    return this._store.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this._store.set(key, value);
  }

  public removeItem(key: string): void {
    this._store.delete(key);
  }
}

/**
 * Browser LocalStorage adapter with safe fallback
 */
export class LocalStorageAdapter implements IStorage {
  private fallback = new MemoryStorage();

  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
      return false;
    }
  }

  public getItem(key: string): string | null {
    if (this.isAvailable()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return this.fallback.getItem(key);
      }
    }
    return this.fallback.getItem(key);
  }

  public setItem(key: string, value: string): void {
    if (this.isAvailable()) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        this.fallback.setItem(key, value);
        return;
      }
    }
    this.fallback.setItem(key, value);
  }

  public removeItem(key: string): void {
    if (this.isAvailable()) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        this.fallback.removeItem(key);
        return;
      }
    }
    this.fallback.removeItem(key);
  }
}

/**
 * Async storage adapter for React Native (accepts AsyncStorage-compatible object)
 */
export class AsyncStorageAdapter implements IStorage {
  private asyncStore: any;
  private memory = new MemoryStorage();

  constructor(asyncStore?: any) {
    this.asyncStore = asyncStore;
  }

  public async getItem(key: string): Promise<string | null> {
    if (this.asyncStore && typeof this.asyncStore.getItem === 'function') {
      try {
        return await this.asyncStore.getItem(key);
      } catch {
        return this.memory.getItem(key);
      }
    }
    return this.memory.getItem(key);
  }

  public async setItem(key: string, value: string): Promise<void> {
    if (this.asyncStore && typeof this.asyncStore.setItem === 'function') {
      try {
        await this.asyncStore.setItem(key, value);
        return;
      } catch {
        this.memory.setItem(key, value);
        return;
      }
    }
    this.memory.setItem(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    if (this.asyncStore && typeof this.asyncStore.removeItem === 'function') {
      try {
        await this.asyncStore.removeItem(key);
        return;
      } catch {
        this.memory.removeItem(key);
        return;
      }
    }
    this.memory.removeItem(key);
  }
}
