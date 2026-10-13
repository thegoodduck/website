type MessageHandler = (data: { from: string; type: string; payload: unknown }) => void;

export class SignalClient {
  private eventSource: EventSource | null = null;
  private handlers: MessageHandler[] = [];
  private room: string;
  private peerId: string;

  constructor(room: string, peerId: string) {
    this.room = room;
    this.peerId = peerId;
  }

  connect(): void {
    this.eventSource = new EventSource(
      `/api/signal?room=${encodeURIComponent(this.room)}&peer=${encodeURIComponent(this.peerId)}`
    );

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlers.forEach(h => h(data));
      } catch {}
    };

    this.eventSource.onerror = () => {
      // Reconnect after a delay
      setTimeout(() => {
        this.close();
        this.connect();
      }, 3000);
    };
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async send(to: string, type: string, payload: unknown): Promise<void> {
    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: this.room,
        from: this.peerId,
        to,
        type,
        payload,
      }),
    });
  }

  close(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}
