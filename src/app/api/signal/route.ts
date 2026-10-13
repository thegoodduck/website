import { NextRequest, NextResponse } from 'next/server';

interface PeerEntry {
  peerId: string;
  controller: ReadableStreamDefaultController;
}

const rooms = new Map<string, PeerEntry[]>();

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get('room');
  const peer = request.nextUrl.searchParams.get('peer');
  if (!room || !peer) {
    return NextResponse.json({ error: 'Missing room or peer' }, { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      if (!rooms.has(room)) rooms.set(room, []);
      const peers = rooms.get(room)!;

      // Notify existing peers about new join
      const joinMsg = `data: ${JSON.stringify({ from: peer, type: 'peer-join' })}\n\n`;
      for (const p of peers) {
        try { p.controller.enqueue(new TextEncoder().encode(joinMsg)); } catch {}
      }

      peers.push({ peerId: peer, controller });

      // Send keepalive
      const keepalive = setInterval(() => {
        try { controller.enqueue(new TextEncoder().encode(': keepalive\n\n')); } catch { clearInterval(keepalive); }
      }, 15000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        const idx = peers.findIndex(p => p.peerId === peer);
        if (idx !== -1) peers.splice(idx, 1);
        if (peers.length === 0) rooms.delete(room);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { room, from, to, type, payload } = body;

  if (!room || !from || !type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const peers = rooms.get(room);
  if (!peers) return NextResponse.json({ ok: true });

  const msg = `data: ${JSON.stringify({ from, type, payload })}\n\n`;
  const encoded = new TextEncoder().encode(msg);

  for (const p of peers) {
    if (to && p.peerId !== to) continue;
    if (p.peerId === from) continue;
    try { p.controller.enqueue(encoded); } catch {}
  }

  return NextResponse.json({ ok: true });
}
