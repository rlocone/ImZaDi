# ImZaDi v2

ImZaDi v2 is a Next.js 14 application for publishing and browsing story-driven posts with attached media. It is built around a unified content model where each post can include PDFs, images, audio, and video, then present those assets through a polished dark-themed reading experience.

The project is designed to run in Docker, backed by PostgreSQL via Prisma, and served from a mounted storage volume for media files.

## What this project does

- Displays published story posts on a public home page
- Renders individual story pages with featured image, audio player, and PDF links
- Stores and serves media through a unified media model
- Exposes JSON API routes for post creation, media upload, and feed generation
- Supports RSS/Atom-style feed consumption via `/feed`
- Includes reusable UI components for sharing, playback, uploads, and PDF browsing
- Packages for containerized deployment with a custom production server

## Technology stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, Tailwind CSS, Lucide icons
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation / utilities:** Zod, date-fns, clsx, tailwind-merge
- **Runtime:** Node.js 20
- **Deployment:** Docker, custom standalone server

## Repository layout

```text
app/         Next.js routes, pages, API handlers, and feed generation
components/   Client-side UI components for media, sharing, and playback
lib/         Shared database and storage helpers
prisma/      Prisma schema and database models
public/      Static site assets
scripts/     Seed and content-processing scripts
```

## Application overview

### Public pages

#### Home page
- Shows all published stories in a card grid
- Pulls posts directly from Prisma
- Displays dates, tags, and content-type badges
- Includes social sharing and RSS entry points

#### Story detail page
- Loads a post by slug
- Displays featured image, featured audio, and PDF attachments
- Renders post excerpt content
- Generates per-post metadata for social sharing and SEO

### API routes

#### `GET /api/posts`
Lists posts with optional filters.

Supported query params:
- `limit`
- `offset`
- `published`
- `slug`

#### `POST /api/posts`
Creates a new post and optionally connects existing media and tags.

#### `POST /api/media/upload`
Uploads a single file, stores it on disk, and creates a Media record.

Supported media types:
- PDF
- IMAGE
- AUDIO
- VIDEO

#### `GET /api/media/[...path]`
Streams stored media back to the browser securely.

#### `GET /feed`
Produces an Atom feed for published posts.

## Data model

The Prisma schema centers on three models.

### `BlogPost`
Represents a story entry.

Key fields:
- `title`
- `slug`
- `excerpt`
- `content`
- `featured`
- `published`
- `author`
- `featuredAudioId`
- `featuredImageId`
- timestamps

Relations:
- many `Media` attachments
- many `Tag` entries

### `Media`
Represents an uploaded asset.

Fields include:
- `type`
- `filename`
- `storedPath`
- `url`
- `title`
- `mimeType`
- `size`
- `metadata`
- optional `postId`

### `Tag`
Simple tag taxonomy used to group stories.

### Media types

The schema supports four attachment categories:
- `PDF`
- `IMAGE`
- `AUDIO`
- `VIDEO`

## Storage model

Media files are saved under the path configured by `STORAGE_PATH`.

Default Docker path:
- `/data/imzadi-v2/media`

Subdirectories are type-based:
- `pdfs/`
- `images/`
- `audio/`
- `videos/`

Files are stored with UUID-based filenames to avoid collisions, while the database keeps the original filename and metadata.

## Upload constraints

The media helper enforces type and size limits.

Allowed MIME types include:
- PDF: `application/pdf`
- Images: JPEG, PNG, GIF, WebP, SVG
- Audio: MP3, WAV, OGG, AAC, MP4/M4A
- Video: MP4, WebM, OGG

Max file sizes:
- PDF: 90 MB
- Image: 10 MB
- Audio: 100 MB
- Video: 500 MB

## UI components

### `AudioPlayer`
Custom audio/video player with:
- play/pause control
- seek bar
- volume slider
- mute toggle
- elapsed/total time display

### `PdfList`
Shows attached PDFs with quick-open links and hover descriptions.

### `SocialShare`
Provides:
- native share button
- Facebook share
- Twitter/X share
- LinkedIn share
- copy-link fallback

### `MediaUploader`
Drag-and-drop upload component for PDFs, images, audio, and video.

### `MediaGrid`
Reusable media browser for viewing uploaded files by type or by post.

## Scripts

Available npm scripts from `package.json`:

- `npm run dev` — run the Next.js dev server
- `npm run build` — build production assets
- `npm run start` — run the Next.js server
- `npm run lint` — lint the project
- `npm run db:generate` — generate Prisma client
- `npm run db:push` — push schema to the database
- `npm run db:migrate` — run migrations in deploy mode
- `npm run db:seed` — seed the database

### Seed script

`scripts/seed.ts` creates sample content for testing and demonstrates the expected structure of a post with:
- one audio attachment
- two PDF attachments
- featured content metadata

## Containerization

The repo includes a multi-stage Dockerfile.

### Build flow
1. Install dependencies in a `deps` stage
2. Generate Prisma client and build the app in a `builder` stage
3. Copy the compiled app and assets into a slim production `runner` stage
4. Run the app with a custom `server.js` wrapper

### Runtime expectations
- listens on port `3000`
- binds to `0.0.0.0`
- uses `STORAGE_PATH=/data/imzadi-v2/media`
- expects PostgreSQL available via `DATABASE_URL`

### Docker Compose

The included `docker-compose.yml` is set up for the existing Jennifer infrastructure and maps the app to host port `3008`.

## Configuration

Copy `.env.example` to `.env` and fill in real values.

Common variables used by the app:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_GA_ID` (optional)
- `STORAGE_PATH` (runtime/container use)

## Development notes

- `next.config.js` is set to `output: 'standalone'` for Docker deployment
- Images are unoptimized for simpler deployment behavior
- TypeScript and ESLint build errors are ignored during production builds in the current config
- The app uses `dynamic = 'force-dynamic'` on the main pages and feed route so content is always pulled fresh from the database

## Current project contents

The repository currently contains:

- `app/` — public pages, post pages, API routes, and feed generation
- `components/` — reusable UI components for media and sharing
- `lib/` — Prisma and file-storage helpers
- `prisma/` — the database schema
- `public/` — site images, favicon, and robots file
- `scripts/` — seed and processing utilities
- `Dockerfile` — production container build
- `docker-compose.yml` — deployment wiring for the existing environment
- `server.js` — custom production server entrypoint
- `package.json` / `package-lock.json` — Node dependencies and scripts

## Mirrors

This repository is mirrored to:
- GitHub: `rlocone/ImZaDi`
- Forgejo: `ginger/ImZaDi`

Both mirrors should stay in sync.

## License / content notice

This repository contains the source code for the ImZaDi publishing app. The stories and media displayed by the site may include sensitive themes, and the content should be treated accordingly.
