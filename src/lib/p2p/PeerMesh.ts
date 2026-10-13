import { SignalClient } from './SignalClient';
import { SegmentCache } from './SegmentCache';

const MAX_PEERS = 5;

interface PeerConnection {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  ready: boolean;
}

type StatsCallback = (stats: { peerCount: number; downloaded: number; uploaded: number }) => void;

export class PeerMesh {
  private signal: SignalClient;
  private peers = new Map<string, PeerConnection>();
  private cache: SegmentCache;
  private peerId: string;
  private pendingRequests = new Map<string, { resolve: (data: ArrayBuffer) => void; timer: ReturnType<typeof setTimeout> }>();
  private onStats: StatsCallback | null = null;
  private downloaded = 0;
  private uploaded = 0;

  constructor(room: string, cache: SegmentCache, onStats?: StatsCallback) {
    this.peerId = Math.random().toString(36).slice(2, 10);
    this.cache = cache;
    this.signal = new SignalClient(room, this.peerId);
    this.onStats = onStats || null;
  }

  async start(): Promise<void> {
    this.signal.onMessage(async (msg) => {
      if (msg.from === this.peerId) return;

      switch (msg.type) {
        case 'peer-join':
          if (this.peers.size < MAX_PEERS) {
            await this.createOffer(msg.from);
          }
          break;
        case 'offer':
          await this.handleOffer(msg.from, msg.payload as RTCSessionDescriptionInit);
          break;
        case 'answer':
          await this.handleAnswer(msg.from, msg.payload as RTCSessionDescriptionInit);
          break;
        case 'ice':
          await this.handleIce(msg.from, msg.payload as RTCIceCandidateInit);
          break;
      }
    });

    this.signal.connect();
    await this.signal.send('', 'peer-join', {});
  }

  private createPC(remotePeerId: string): PeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    const conn: PeerConnection = { pc, dc: null, ready: false };
    this.peers.set(remotePeerId, conn);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signal.send(remotePeerId, 'ice', e.candidate.toJSON());
      }
    };

    pc.ondatachannel = (e) => {
      conn.dc = e.channel;
      this.setupDataChannel(conn, remotePeerId);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.removePeer(remotePeerId);
      }
    };

    return conn;
  }

  private setupDataChannel(conn: PeerConnection, remotePeerId: string): void {
    const dc = conn.dc;
    if (!dc) return;

    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      conn.ready = true;
      this.emitStats();
    };

    dc.onclose = () => {
      conn.ready = false;
      this.emitStats();
    };

    dc.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data);
        if (msg.type === 'request' && this.cache.has(msg.url)) {
          const segment = this.cache.get(msg.url)!;
          dc.send(JSON.stringify({ type: 'segment-header', url: msg.url, size: segment.byteLength }));
          dc.send(segment);
          this.uploaded += segment.byteLength;
          this.emitStats();
        } else if (msg.type === 'segment-header') {
          // Next binary message will be the segment data
          const pending = this.pendingRequests.get(msg.url);
          if (pending) {
            // Will be resolved by the binary handler
          }
        }
      } else if (e.data instanceof ArrayBuffer) {
        // Find which pending request this satisfies (last segment-header)
        for (const [url, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.resolve(e.data);
          this.pendingRequests.delete(url);
          this.downloaded += e.data.byteLength;
          this.emitStats();
          break;
        }
      }
    };
  }

  private async createOffer(remotePeerId: string): Promise<void> {
    const conn = this.createPC(remotePeerId);
    conn.dc = conn.pc.createDataChannel('segments');
    this.setupDataChannel(conn, remotePeerId);

    const offer = await conn.pc.createOffer();
    await conn.pc.setLocalDescription(offer);
    await this.signal.send(remotePeerId, 'offer', conn.pc.localDescription!.toJSON());
  }

  private async handleOffer(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    if (this.peers.size >= MAX_PEERS) return;
    const conn = this.createPC(from);
    await conn.pc.setRemoteDescription(offer);
    const answer = await conn.pc.createAnswer();
    await conn.pc.setLocalDescription(answer);
    await this.signal.send(from, 'answer', conn.pc.localDescription!.toJSON());
  }

  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const conn = this.peers.get(from);
    if (conn) {
      await conn.pc.setRemoteDescription(answer);
    }
  }

  private async handleIce(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const conn = this.peers.get(from);
    if (conn) {
      await conn.pc.addIceCandidate(candidate);
    }
  }

  requestSegment(url: string, timeoutMs = 2000): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      let responded = false;

      const timer = setTimeout(() => {
        if (!responded) {
          this.pendingRequests.delete(url);
          resolve(null);
        }
      }, timeoutMs);

      this.pendingRequests.set(url, {
        resolve: (data) => {
          responded = true;
          resolve(data);
        },
        timer,
      });

      for (const [, conn] of this.peers) {
        if (conn.ready && conn.dc?.readyState === 'open') {
          conn.dc.send(JSON.stringify({ type: 'request', url }));
        }
      }
    });
  }

  private removePeer(id: string): void {
    const conn = this.peers.get(id);
    if (conn) {
      conn.dc?.close();
      conn.pc.close();
      this.peers.delete(id);
      this.emitStats();
    }
  }

  private emitStats(): void {
    this.onStats?.({
      peerCount: [...this.peers.values()].filter(p => p.ready).length,
      downloaded: this.downloaded,
      uploaded: this.uploaded,
    });
  }

  destroy(): void {
    for (const [id] of this.peers) {
      this.removePeer(id);
    }
    this.signal.close();
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
    }
    this.pendingRequests.clear();
  }
}
