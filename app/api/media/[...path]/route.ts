import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync } from 'fs';
import { stat } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';

// Base storage directory
const STORAGE_BASE = process.env.STORAGE_PATH || '/data/imzadi-v2/media';

/**
 * GET /api/media/[...path]
 * Serve stored media files
 *
 * Path format: pdfs/abc123.pdf, images/abc123.jpg, etc.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const pathParts = params.path;
    if (!pathParts || pathParts.length === 0) {
      return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }

    // Prevent directory traversal
    const filename = pathParts.join('/');
    if (filename.includes('..') || filename.includes('~')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const filePath = join(STORAGE_BASE, filename);

    // Security check: ensure file is within storage directory
    if (!filePath.startsWith(STORAGE_BASE)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stats = await stat(filePath);
    const fileSize = stats.size;

    // Determine content type from extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      mp4: 'video/mp4',
      webm: 'video/webm',
    };
    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';

    // Stream file
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Media serve error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
