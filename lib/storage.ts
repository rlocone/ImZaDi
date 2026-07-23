import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Base storage directory — mounted volume in Docker
const STORAGE_BASE = process.env.STORAGE_PATH || '/data/imzadi-v2/media';

const TYPE_DIRS = {
  PDF: 'pdfs',
  IMAGE: 'images',
  AUDIO: 'audio',
  VIDEO: 'videos',
} as const;

type MediaType = 'PDF' | 'IMAGE' | 'AUDIO' | 'VIDEO';

/**
 * Get the full filesystem path for a stored file
 */
export function getStoragePath(relativePath: string): string {
  return join(STORAGE_BASE, relativePath);
}

/**
 * Get the public URL path for a media file
 */
export function getMediaUrl(relativePath: string): string {
  return `/api/media/${relativePath}`;
}

/**
 * Store a file and return the stored path
 */
export async function storeFile(
  buffer: Buffer,
  originalFilename: string,
  mediaType: MediaType
): Promise<{ storedPath: string; filename: string; size: number }> {
  const ext = getExtension(originalFilename);
  const uuid = randomUUID();
  const dir = TYPE_DIRS[mediaType];
  const storedFilename = `${uuid}${ext}`;
  const storedPath = `${dir}/${storedFilename}`;

  const fullDir = join(STORAGE_BASE, dir);
  if (!existsSync(fullDir)) {
    await mkdir(fullDir, { recursive: true });
  }

  const fullPath = join(STORAGE_BASE, storedPath);
  await writeFile(fullPath, buffer);

  return {
    storedPath,
    filename: originalFilename,
    size: buffer.length,
  };
}

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot) : '';
}

/**
 * Validate media type from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType | null {
  if (mimeType.startsWith('application/pdf')) return 'PDF';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return null;
}

/**
 * Allowed MIME types
 */
export const ALLOWED_MIME_TYPES = {
  PDF: ['application/pdf'],
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/aac', 'audio/mp4', 'audio/x-m4a'],
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg'],
};

export const MAX_FILE_SIZES = {
  PDF: 90 * 1024 * 1024,    // 90MB (increased from 60MB)
  IMAGE: 10 * 1024 * 1024,  // 10MB
  AUDIO: 100 * 1024 * 1024, // 100MB
  VIDEO: 500 * 1024 * 1024, // 500MB
};
