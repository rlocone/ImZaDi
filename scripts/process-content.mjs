#!/usr/bin/env node
/**
 * ImZaDi v2 — Content Processor
 * 
 * Reads a folder of raw content (PDFs, audio, images) and creates a blog post.
 * 
 * Usage:
 *   node scripts/process-content.mjs /path/to/content-folder [--title "Post Title"]
 * 
 * Input folder structure:
 *   /path/to/content-folder/
 *     - *.pdf          → uploaded as PDF attachments
 *     - *.mp3/*.wav    → uploaded as audio (first one becomes featured audio)
 *     - *.jpg/*.png    → uploaded as images (first one becomes featured image)
 *     - content.txt    → (optional) raw text content for summary
 *     - content.md     → (optional) markdown content
 *     - summary.txt    → (optional) pre-written summary/excerpt
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { createReadStream, existsSync } from 'fs';

// Configuration
const API_BASE = process.env.IMZADI_API || 'http://localhost:3004';
const UPLOAD_ENDPOINT = `${API_BASE}/api/media/upload`;
const POSTS_ENDPOINT = `${API_BASE}/api/posts`;

// File type mappings
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const PDF_EXTS = ['.pdf'];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function error(msg) {
  console.error(`[${new Date().toISOString()}] ERROR: ${msg}`);
}

/**
 * Upload a file to imzadi-v2
 */
async function uploadFile(filePath, type, title) {
  const filename = basename(filePath);
  log(`Uploading ${type}: ${filename}`);
  
  const formData = new FormData();
  formData.append('file', await fileToBlob(filePath), filename);
  formData.append('type', type);
  formData.append('title', title || filename);
  
  const response = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${err}`);
  }
  
  const data = await response.json();
  log(`Uploaded: ${data.media.id} → ${data.media.url}`);
  return data.media;
}

/**
 * Convert file path to Blob
 */
async function fileToBlob(filePath) {
  const buffer = readFileSync(filePath);
  const filename = basename(filePath);
  const ext = extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  
  return new Blob([buffer], { type: mimeTypes[ext] || 'application/octet-stream' });
}

/**
 * Create a blog post
 */
async function createPost(postData) {
  log(`Creating post: ${postData.title}`);
  
  const response = await fetch(POSTS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postData),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Post creation failed: ${err}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Get media files from folder
 */
function scanFolder(folderPath) {
  const files = readdirSync(folderPath);
  const result = {
    pdfs: [],
    audio: [],
    images: [],
    content: null,
    summary: null,
    title: null,
  };
  
  for (const file of files) {
    const filePath = join(folderPath, file);
    const ext = extname(file).toLowerCase();
    const base = basename(file, ext).toLowerCase();
    
    if (PDF_EXTS.includes(ext)) {
      result.pdfs.push(filePath);
    } else if (AUDIO_EXTS.includes(ext)) {
      result.audio.push(filePath);
    } else if (IMAGE_EXTS.includes(ext)) {
      result.images.push(filePath);
    } else if (file === 'content.txt' || file === 'content.md') {
      result.content = readFileSync(filePath, 'utf-8');
    } else if (file === 'summary.txt') {
      result.summary = readFileSync(filePath, 'utf-8').trim();
    } else if (file === 'title.txt') {
      result.title = readFileSync(filePath, 'utf-8').trim();
    }
  }
  
  return result;
}

/**
 * Generate slug from title
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Main processor
 */
async function processContent(inputPath, options = {}) {
  log(`Processing content from: ${inputPath}`);
  
  if (!existsSync(inputPath)) {
    throw new Error(`Folder not found: ${inputPath}`);
  }
  
  const folder = scanFolder(inputPath);
  
  if (folder.pdfs.length === 0 && folder.audio.length === 0 && folder.images.length === 0) {
    throw new Error('No media files found in folder');
  }
  
  // Determine title
  const title = options.title || folder.title || basename(inputPath);
  const slug = slugify(title);
  log(`Post title: ${title}`);
  
  // Upload all media and collect IDs
  const mediaIds = [];
  let featuredImageId = null;
  let featuredAudioId = null;
  
  // Upload PDFs
  for (const pdf of folder.pdfs) {
    const media = await uploadFile(pdf, 'PDF', basename(pdf));
    mediaIds.push(media.id);
  }
  
  // Upload audio
  for (const audio of folder.audio) {
    const media = await uploadFile(audio, 'AUDIO', basename(audio));
    mediaIds.push(media.id);
    if (!featuredAudioId) featuredAudioId = media.id;
  }
  
  // Upload images
  for (const img of folder.images) {
    const media = await uploadFile(img, 'IMAGE', basename(img));
    mediaIds.push(media.id);
    if (!featuredImageId) featuredImageId = media.id;
  }
  
  // Generate excerpt from content or summary
  let excerpt = folder.summary || `Media collection: ${folder.pdfs.length} PDFs, ${folder.audio.length} audio files, ${folder.images.length} images.`;
  
  // Use content as body if available
  let content = folder.content || null;
  
  // Create the post
  const post = await createPost({
    title,
    slug,
    excerpt,
    content,
    mediaIds,
    featuredImageId,
    featuredAudioId,
    published: true,
  });
  
  log('----------------------------------------');
  log('Post created successfully!');
  log(`URL: ${API_BASE}/post/${slug}`);
  log(`ID: ${post.id}`);
  log(`Media attached: ${mediaIds.length} files`);
  log('----------------------------------------');
  
  return post;
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(`
ImZaDi v2 — Content Processor

Usage:
  node scripts/process-content.mjs <folder-path> [options]

Options:
  --title "Post Title"    Override the post title
  --api "http://..."      Override API base URL

Example:
  node scripts/process-content.mjs /data/incoming/my-story
  `);
  process.exit(1);
}

const folderPath = args[0];
const options = {};

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--title' && args[i + 1]) {
    options.title = args[++i];
  }
  if (args[i] === '--api' && args[i + 1]) {
    process.env.IMZADI_API = args[++i];
  }
}

processContent(folderPath, options)
  .then(() => process.exit(0))
  .catch((err) => {
    error(err.message);
    process.exit(1);
  });
