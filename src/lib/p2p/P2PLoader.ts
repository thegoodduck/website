import type { PeerMesh } from './PeerMesh';
import type { SegmentCache } from './SegmentCache';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function createP2PLoader(mesh: PeerMesh | null, cache: SegmentCache) {
  return class P2PLoader {
    private abortController: AbortController | null = null;

    constructor(_config: any) {}

    async load(context: any, _config: any, callbacks: any): Promise<void> {
      const url: string = context.url;
      const isSegment = url.includes('.ts') || url.includes('.m4s');

      if (isSegment) {
        const cached = cache.get(url);
        if (cached) {
          callbacks.onSuccess(
            { data: cached, url },
            { trequest: performance.now(), tfirst: performance.now(), tload: performance.now(), loaded: cached.byteLength, total: cached.byteLength },
            context,
            null,
          );
          return;
        }

        if (mesh) {
          const peerData = await mesh.requestSegment(url, 2000);
          if (peerData) {
            cache.set(url, peerData);
            callbacks.onSuccess(
              { data: peerData, url },
              { trequest: performance.now(), tfirst: performance.now(), tload: performance.now(), loaded: peerData.byteLength, total: peerData.byteLength },
              context,
              null,
            );
            return;
          }
        }
      }

      this.abortController = new AbortController();
      try {
        const response = await fetch(url, { signal: this.abortController.signal });
        const data = await response.arrayBuffer();
        if (isSegment) cache.set(url, data);

        callbacks.onSuccess(
          { data, url },
          { trequest: performance.now(), tfirst: performance.now(), tload: performance.now(), loaded: data.byteLength, total: data.byteLength },
          context,
          null,
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        callbacks.onError(
          { code: 0, text: err instanceof Error ? err.message : 'Load failed' },
          context,
          null,
          null,
        );
      }
    }

    abort(): void {
      this.abortController?.abort();
    }

    destroy(): void {
      this.abort();
    }
  };
}
