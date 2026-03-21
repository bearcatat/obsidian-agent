export class FileMutex {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>(resolve => {
      release = resolve;
    });

    const prev = this.locks.get(key) || Promise.resolve();
    this.locks.set(key, prev.then(() => next).catch(() => next));

    await prev;
    
    return () => {
      release();
      // Clean up the map if this is the last promise in the chain
      if (this.locks.get(key) === next) {
        this.locks.delete(key);
      }
    };
  }
}

export const fileMutex = new FileMutex();