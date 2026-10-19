/**
 * SPA Auto Pageview listener:
 * Wraps history.pushState & history.replaceState and listens to popstate event.
 */

export class AutoPageviewTracker {
  private onRouteChange: (newPath: string) => void;
  private isListening = false;
  private lastTrackedPath = '';

  constructor(onRouteChange: (newPath: string) => void) {
    this.onRouteChange = onRouteChange;
  }

  public start(): void {
    if (typeof window === 'undefined' || typeof history === 'undefined' || this.isListening) {
      return;
    }

    this.isListening = true;
    this.lastTrackedPath = window.location.pathname + window.location.search;

    const notify = () => {
      if (typeof window === 'undefined') return;
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== this.lastTrackedPath) {
        this.lastTrackedPath = currentPath;
        this.onRouteChange(currentPath);
      }
    };

    // Monkey-patch pushState & replaceState safely
    const originalPushState = history.pushState;
    if (typeof originalPushState === 'function') {
      history.pushState = function (...args) {
        const ret = originalPushState.apply(this, args);
        setTimeout(notify, 0);
        return ret;
      };
    }

    const originalReplaceState = history.replaceState;
    if (typeof originalReplaceState === 'function') {
      history.replaceState = function (...args) {
        const ret = originalReplaceState.apply(this, args);
        setTimeout(notify, 0);
        return ret;
      };
    }

    window.addEventListener('popstate', notify);
  }
}
