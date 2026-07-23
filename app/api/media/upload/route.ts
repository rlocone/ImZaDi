import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, MediaType } from '@prisma/client';
import {
  storeFile,
  getMediaTypeFromMime,
  getMediaUrl,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
} from '@/lib/storage';

const prisma = new PrismaClient();

/**
 * POST /api/media/upload
 * Upload a file (PDF, image, audio)
 *
 * FormData body:
 *   - file: File (required)
 *   - type: 'PDF' | 'IMAGE' | 'AUDIO' (required)
 *   - title: string (optional)
 *   - postId: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const typeStr = formData.get('type') as string | null;
    const title = formData.get('title') as string | null;
    const postId = formData.get('postId') as string | null;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate type
    if (!typeStr || !['PDF', 'IMAGE', 'AUDIO', 'VIDEO'].includes(typeStr)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be PDF, IMAGE, AUDIO, or VIDEO' },
        { status: 400 }
      );
    }
    const mediaType = typeStr as MediaType;

    // Validate MIME type matches declared type
    const mimeType = file.type;
    const allowedMimes = ALLOWED_MIME_TYPES[mediaType];
    if (!allowedMimes.includes(mimeType)) {
      return NextResponse.json(
        { error: `Invalid file type for ${mediaType}. Allowed: ${allowedMimes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSize = MAX_FILE_SIZES[mediaType];
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Max size for ${mediaType}: ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Store file
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storedPath, filename, size } = await storeFile(buffer, file.name, mediaType);

    // Create database record
    const media = await prisma.media.create({
      data: {
        type: mediaType,
        filename,
        storedPath,
        url: getMediaUrl(storedPath),
        title: title || null,
        mimeType,
        size,
        postId: postId || null,
      },
    });

    return NextResponse.json({
      success: true,
      media: {
        id: media.id,
        type: media.type,
        filename: media.filename,
        url: media.url,
        title: media.title,
        mimeType: media.mimeType,
        size: media.size,
        createdAt: media.createdAt,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/media/upload
 * List media files (with optional filters)
 *
 * Query params:
 *   - type: filter by MediaType
 *   - postId: filter by post
 *   - limit: max results (default 20)
 *   - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as MediaType | null;
    const postId = searchParams.get('postId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (type && ['PDF', 'IMAGE', 'AUDIO', 'VIDEO'].includes(type)) {
      where.type = type;
    }
    if (postId) {
      where.postId = postId;
    }

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: { id: true, title: true, slug: true },
          },
        },
      }),
      prisma.media.count({ where }),
    ]);

    return NextResponse.json({
      media,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + media.length < total,
      },
    });
  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json(
      { error: 'Failed to list media' },
      { status: 500 }
    );
  }
}
