import { useEffect, useCallback } from 'react';

interface VisibilityHandler {
  id: string;
  onVisible: () => void;
  onHidden: () => void;
}

class VisibilityManager {
  private static instance: VisibilityManager | null = null;
  private handlers: Map<string, VisibilityHandler> = new Map();
  private isVisible = true;
  private listenerAttached = false;

  private constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  static getInstance(): VisibilityManager {
    if (!VisibilityManager.instance) {
      VisibilityManager.instance = new VisibilityManager();
    }
    return VisibilityManager.instance;
  }

  private handleVisibilityChange = () => {
    const wasVisible = this.isVisible;
    this.isVisible = document.visibilityState === 'visible';
    
    if (wasVisible === this.isVisible) return; // No change

    // Page visibility changed

    this.handlers.forEach((handler, id) => {
      try {
        if (this.isVisible) {
          handler.onVisible();
        } else {
          handler.onHidden();
        }
      } catch (error) {
        // Error in visibility handler
      }
    });
  };

  register(handler: VisibilityHandler): () => void {
    this.handlers.set(handler.id, handler);

    // Attach listener only when first handler is registered
    if (!this.listenerAttached) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.listenerAttached = true;
    }

    // Return cleanup function
    return () => {
      this.handlers.delete(handler.id);
      
      // Remove listener when no handlers remain
      if (this.handlers.size === 0 && this.listenerAttached) {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.listenerAttached = false;
      }
    };
  }

  getVisibilityState(): boolean {
    return this.isVisible;
  }

  // For debugging
  getActiveHandlerCount(): number {
    return this.handlers.size;
  }
}

export const useVisibilityManager = (
  id: string,
  onVisible: () => void,
  onHidden: () => void
): boolean => {
  const manager = VisibilityManager.getInstance();

  useEffect(() => {
    const cleanup = manager.register({
      id,
      onVisible,
      onHidden
    });

    return cleanup;
  }, [id, onVisible, onHidden]);

  return manager.getVisibilityState();
};

// Export singleton for direct access in services
export const visibilityManager = VisibilityManager.getInstance();