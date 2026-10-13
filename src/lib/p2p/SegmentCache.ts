const MAX_ENTRIES = 50;

export class SegmentCache {
  private cache = new Map<string, ArrayBuffer>();
  private order: string[] = [];

  has(url: string): boolean {
    return this.cache.has(url);
  }

  get(url: string): ArrayBuffer | undefined {
    return this.cache.get(url);
  }

  set(url: string, data: ArrayBuffer): void {
    if (this.cache.has(url)) return;
    if (this.order.length >= MAX_ENTRIES) {
      const oldest = this.order.shift()!;
      this.cache.delete(oldest);
    }
    this.cache.set(url, data);
    this.order.push(url);
  }

  keys(): string[] {
    return [...this.cache.keys()];
  }
}
