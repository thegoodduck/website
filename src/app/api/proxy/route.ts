import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': parsedUrl.origin + '/',
        'Origin': parsedUrl.origin,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return new NextResponse('Upstream error', { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';
    const isPlaylist = url.includes('.m3u8') || contentType.includes('mpegurl');

    if (isPlaylist) {
      let body = await res.text();
      // Rewrite segment/playlist URLs to go through proxy
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      body = body.replace(/^(?!#)(\S+\.(?:ts|m3u8|m4s|key|mp4)[^\s]*)/gm, (match) => {
        const absolute = match.startsWith('http') ? match : `${baseUrl}${match}`;
        return `/api/proxy?url=${encodeURIComponent(absolute)}`;
      });

      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Binary segment — stream through
    const arrayBuffer = await res.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType || 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new NextResponse('Proxy error', { status: 502 });
  }
}
