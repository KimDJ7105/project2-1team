// server/src/sessions/disconnectTimerManager.ts
class DisconnectTimerManager {
  private timers = new Map<string, NodeJS.Timeout>();

  set(email: string, timer: NodeJS.Timeout): void {
    this.clear(email);
    this.timers.set(email, timer);
  }

  get(email: string): NodeJS.Timeout | undefined {
    return this.timers.get(email);
  }

  has(email: string): boolean {
    return this.timers.has(email);
  }

  clear(email: string): void {
    if (this.timers.has(email)) {
      clearTimeout(this.timers.get(email));
      this.timers.delete(email);
    }
  }
}

export const disconnectTimerManager = new DisconnectTimerManager();