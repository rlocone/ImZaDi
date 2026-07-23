#!/usr/bin/env python3
"""
ImZaDi v2 — Article Pipeline
Extracts excerpt + cover image from PDF, uploads both, creates/updates post.
Supports --tags to attach genre/style tags to the post.
"""

import os
import re
import json
import time
import uuid
import subprocess
import base64
import requests
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Config ────────────────────────────────────────────────────────────────────
API_BASE    = os.environ.get("IMZADI_API", "http://localhost:3004")
UPLOAD_URL  = f"{API_BASE}/api/media/upload"
POSTS_URL   = f"{API_BASE}/api/posts"
TAGS_URL    = f"{API_BASE}/api/tags"
STORAGE_DIR = Path.home() / "imzadi-content"
OUT_DIR     = Path("/tmp/imzadi-covers")

# ── Helpers ────────────────────────────────────────────────────────────────────
def run(cmd, **kwargs):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, **kwargs)
    return result.stdout, result.stderr, result.returncode

def slugify(text):
    slug = text.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

def api_json(url, data=None, method=None):
    """POST or GET JSON data. Returns parsed JSON or None on error."""
    body = json.dumps(data).encode('utf-8') if data is not None else None
    req = Request(url, data=body, method=method)
    req.add_header('Content-Type', 'application/json')
    try:
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except HTTPError as e:
        print(f"    HTTP {e.code}: {e.read().decode('utf-8')[:300]}")
        return None
    except Exception as e:
        print(f"    Error: {e}")
        return None

def get_or_create_tags(tag_names):
    """Get or create tags by name. Returns list of tag ID strings."""
    if not tag_names:
        return []
    tag_ids = []
    for name in tag_names:
        result = api_json(TAGS_URL, data={'name': name.strip()}, method='POST')
        if result and result.get('success'):
            # Use the first tag from the response (might be upserted)
            tag = result['tags'][0]
            tag_ids.append(tag['id'])
            print(f"    Tag: {tag['name']} ({tag['id']})")
        time.sleep(0.25)
    return tag_ids

def extract_excerpt(pdf_path, max_chars=500):
    """Extract clean text from the PDF — grab the first meaningful paragraphs."""
    out, err, rc = run(f"pdftotext {str(pdf_path)!r} -")
    if rc != 0:
        print(f"    pdftotext failed: {err}")
        return None

    lines = out.splitlines()
    skip_patterns = [
        r'^\s*\d+\s*$',                     # standalone page numbers
        r'^(Spanish|Italian|Overall)$',
        r"^(Lets delve)",
    ]

    cleaned = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        skip = any(re.match(p, stripped) for p in skip_patterns)
        if skip:
            continue
        # Stop at translation/analysis sections
        if re.match(r"^(Spanish|Italian|Overall|Lets delve)", stripped):
            break
        cleaned.append(stripped)

    excerpt = ""
    for line in cleaned:
        if len(excerpt) + len(line) + 1 > max_chars:
            break
        excerpt += (" " if excerpt else "") + line

    return excerpt.strip() if excerpt else None

# ── AI Cover Generation ────────────────────────────────────────────────────────
# Story-type -> cover prompt template
_STORY_PROMPTS = {
    "romance": (
        "A romantic book cover: {context} warm golden hour lighting, "
        "emotional and tender atmosphere, soft bokeh background, "
        "contemporary romance art style. NO text, no words, no title, "
        "no author name, no signatures anywhere in the image."
    ),
    "thriller": (
        "A dark thriller book cover: {context} moody noir aesthetic, "
        "deep shadows and dramatic lighting, cinematic atmosphere, "
        "suspenseful mood, crime drama style, dark palette with crimson accents. "
        "NO text, no words, no title, no author name, no signatures anywhere in the image."
    ),
    "scifi": (
        "A science fiction book cover: {context} futuristic aesthetic, "
        "cold blue-white lighting, cosmic or high-tech elements, "
        "hard sci-fi atmosphere, deep blacks with electric blue accents. "
        "NO text, no words, no title, no author name, no signatures anywhere in the image."
    ),
    "family": (
        "A literary fiction book cover: {context} warm amber and earth tones, "
        "emotional family drama atmosphere, intimate and contemplative mood, "
        "literary fiction cover art style, understated elegance. "
        "NO text, no words, no title, no author name, no signatures anywhere in the image."
    ),
    "fantasy": (
        "A dramatic dark fantasy book cover: {context} cinematic lighting, "
        "moody atmosphere with ethereal elements, digital art, "
        "ornate decorative border. "
        "NO text, no words, no title, no author name, no signatures anywhere in the image."
    ),
    "default": (
        "A compelling story book cover: {context} "
        "cinematic atmosphere, emotional mood, professional cover art style, "
        "balanced composition, warm and cool tones. "
        "NO text, no words, no title, no author name, no signatures anywhere in the image."
    ),
}

_STORY_TYPE_KEYWORDS = {
    "romance":    ["love", "couple", "lovers", "heart", "first", "forever", "kiss", "passion", "marry"],
    "thriller":   ["kill", "murder", "dark", "crime", "secret", "burn", "shadow", "solitude", "twist"],
    "scifi":      ["quantum", "cyber", "ai", "robot", "future", "space", "neural", "data", "tech", "q-day", "astound"],
    "family":     ["family", "mother", "father", "parent", "child", "sister", "brother", "kin", "generations"],
    "fantasy":    ["magic", "dragon", "spell", "realm", "mythic", "shield", "protect"],
}

def _detect_story_type(story_name, excerpt):
    """Detect story genre from name + excerpt for prompt selection."""
    text = f"{story_name} {excerpt or ''}".lower()
    scores = {}
    for stype, keywords in _STORY_TYPE_KEYWORDS.items():
        scores[stype] = sum(1 for kw in keywords if kw in text)
    if max(scores.values()) == 0:
        return "default"
    return max(scores, key=scores.get)

def _build_cover_prompt(story_name, excerpt):
    """Build an AI image generation prompt from story metadata."""
    # Extract a short context line from the excerpt (first meaningful sentence)
    context = ""
    if excerpt:
        # Grab first 120 chars of excerpt, clean up emoji and artifacts
        clean = re.sub(r'[\U00010000-\U0010ffff]', '', excerpt)  # remove emoji
        clean = re.sub(r'\s+', ' ', clean).strip()
        context = clean[:120]
        if len(clean) > 120:
            context += "..."
    else:
        context = story_name.replace('_', ' ').replace('-', ' ')
    story_type = _detect_story_type(story_name, excerpt)
    template = _STORY_PROMPTS.get(story_type, _STORY_PROMPTS["default"])
    return template.format(context=context)

def generate_ai_cover(story_name, excerpt, out_path):
    """
    Generate an AI cover image via OpenRouter gemini-2.5-flash-image.
    Returns True if successful, False otherwise.
    Requires OPENROUTER_API_KEY env var.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("    OPENROUTER_API_KEY not set, skipping AI cover")
        return False

    prompt = _build_cover_prompt(story_name, excerpt)
    print(f"    AI prompt ({len(prompt)} chars): {prompt[:80]}...")

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": os.environ.get("IMZADI_API", "http://localhost:3004"),
                "X-Title": "ImZaDi Blog",
            },
            json={
                "model": "google/gemini-2.5-flash-image",
                "messages": [{
                    "role": "user",
                    "content": f"Generate an image for a story book cover. {prompt} Respond only with the image."
                }],
                "max_tokens": 1024,
            },
            timeout=120,
        )
        if resp.status_code != 200:
            print(f"    OpenRouter error {resp.status_code}: {resp.text[:200]}")
            return False

        data = resp.json()
        img_data = data["choices"][0]["message"]["images"][0]["image_url"]["url"]
        b64 = img_data.split("base64,")[1]
        png_bytes = base64.b64decode(b64)
        with open(out_path, "wb") as f:
            f.write(png_bytes)
        print(f"    AI cover saved: {out_path.name} ({len(png_bytes) / 1024:.0f}KB)")
        return True
    except (KeyError, IndexError, ValueError) as e:
        print(f"    AI image parse error: {e}")
        return False
    except Exception as e:
        print(f"    AI cover error: {e}")
        return False

def generate_cover(pdf_path, out_dir, story_name=None, excerpt=None):
    """
    Generate cover image: try AI first (if key available), fall back to pdftoppm.
    story_name and excerpt are used for AI prompt construction.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(pdf_path).stem
    out_path = out_dir / f"{stem}-cover.png"

    # Try AI generation first
    if story_name:
        ai_ok = generate_ai_cover(story_name, excerpt, out_path)
        if ai_ok and out_path.exists() and out_path.stat().st_size > 10000:
            return out_path
        # If AI failed or produced tiny file, clean up and fall back
        if out_path.exists():
            out_path.unlink()

    # Fall back to pdftoppm
    print(f"    Falling back to pdftoppm for cover...")
    cmd = f"pdftoppm -r 150 -png {str(pdf_path)!r} {str(out_dir / stem)!r} -f 1 -l 1"
    out, err, rc = run(cmd)
    if rc != 0:
        print(f"    pdftoppm failed: {err}")
        return None

    actual = out_dir / f"{stem}-01.png"
    if actual.exists():
        actual.rename(out_path)

    return out_path if out_path.exists() else None

def upload_media(filepath, media_type, title, post_id=None):
    """Upload a file, return the media dict with id+url."""
    filename = os.path.basename(filepath)
    if not os.path.exists(filepath):
        print(f"    File not found: {filepath}")
        return None

    file_size = os.path.getsize(filepath)
    mime_map = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.m4a': 'audio/mp4',
        '.mp3': 'audio/mpeg',
    }
    ext = os.path.splitext(filepath)[1].lower()
    mime = mime_map.get(ext, 'application/octet-stream')

    print(f"    Uploading {filename} ({file_size/1024/1024:.1f}MB) as {media_type}...")

    try:
        with open(filepath, 'rb') as f:
            file_data = f.read()

        boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
        parts = []
        for name, value in [('type', media_type), ('title', title or filename)]:
            if post_id:
                parts.extend([f'--{boundary}\r\n'.encode(),
                             f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                             f'{value}\r\n'.encode()])
            else:
                parts.extend([f'--{boundary}\r\n'.encode(),
                             f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                             f'{value}\r\n'.encode()])
        if post_id:
            parts.extend([f'--{boundary}\r\n'.encode(),
                         f'Content-Disposition: form-data; name="postId"\r\n\r\n'.encode(),
                         f'{post_id}\r\n'.encode()])

        parts.append(f'--{boundary}\r\n'.encode())
        parts.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode())
        parts.append(f'Content-Type: {mime}\r\n\r\n'.encode())
        parts.append(file_data)
        parts.append(b'\r\n')
        parts.append(f'--{boundary}--\r\n'.encode())

        body = b''.join(parts)
        req = Request(UPLOAD_URL, data=body)
        req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

        with urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get('success'):
                media = result['media']
                print(f"    -> Uploaded, ID: {media['id']}")
                return media
            else:
                print(f"    -> Upload failed: {result}")
                return None
    except HTTPError as e:
        print(f"    -> HTTP {e.code}: {e.read().decode('utf-8')[:300]}")
        return None
    except Exception as e:
        print(f"    -> Error: {e}")
        return None

def check_post_exists(slug):
    """Check if a post with the given slug exists via GET /api/posts/[slug]."""
    try:
        req = Request(f"{POSTS_URL}/{slug}")
        with urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get('success') and result.get('post'):
                return result['post']['id']
    except HTTPError as e:
        if e.code == 404:
            return None
    except Exception:
        pass
    return None

def delete_post(slug):
    """Delete post by slug via DELETE /api/posts/[slug]."""
    try:
        req = Request(f"{POSTS_URL}/{slug}", method='DELETE')
        with urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False

def create_post(title, slug, excerpt, media_ids, featured_image_id=None,
                featured_audio_id=None, tag_ids=None, author="Gloria"):
    """Create a blog post with optional tags."""
    data = {
        "title": title,
        "slug": slug,
        "excerpt": excerpt,
        "author": author,
        "mediaIds": media_ids,
        "published": True,
    }
    if featured_image_id:
        data["featuredImageId"] = featured_image_id
    if featured_audio_id:
        data["featuredAudioId"] = featured_audio_id
    if tag_ids:
        data["tagIds"] = tag_ids

    body = json.dumps(data).encode('utf-8')
    req = Request(POSTS_URL, data=body)
    req.add_header('Content-Type', 'application/json')

    try:
        with urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get('success') or result.get('id'):
                pid = result.get('id') or result.get('post', {}).get('id')
                print(f"    -> Post created: {pid}")
                return pid
            else:
                print(f"    -> Post failed: {result}")
                return None
    except HTTPError as e:
        print(f"    -> HTTP {e.code}: {e.read().decode('utf-8')[:300]}")
        return None

def update_post(slug, patch_data):
    """PATCH an existing post using requests (avoids urllib PATCH issues)."""
    import requests as _req
    try:
        resp = _req.patch(
            f"{POSTS_URL}/{slug}",
            json=patch_data,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"    PATCH error: {e}")
        return False

# ── Main pipeline ──────────────────────────────────────────────────────────────
def process_article(story_dir, force_recreate=False, tags=None):
    story_name = os.path.basename(story_dir)
    print(f"\n{'='*60}")
    print(f"Story: {story_name}")
    if tags:
        print(f"Tags: {tags}")

    files = sorted([f for f in os.listdir(story_dir) if os.path.isfile(os.path.join(story_dir, f))])
    pdfs  = [f for f in files if f.endswith('.pdf')]
    audio = [f for f in files if f.endswith(('.m4a', '.mp3'))]

    if not pdfs:
        print("  No PDFs found, skipping.")
        return False

    def pdf_key(f):
        m = re.match(r'^(\d+)-(.+)$', f)
        return (0, int(m.group(1)), f) if m else (1, 0, f)
    pdfs.sort(key=pdf_key)

    primary_pdf = os.path.join(story_dir, pdfs[0])
    print(f"  Primary PDF: {pdfs[0]}")

    slug = slugify(story_name)
    existing_id = check_post_exists(slug)
    existing_post = None
    if existing_id:
        if force_recreate:
            print(f"  Existing post found ({existing_id}), deleting for recreate...")
            deleted = delete_post(slug)
            if not deleted:
                print("  Could not delete, trying update instead...")
                existing_post = {'id': existing_id}
        else:
            print(f"  Existing post found ({existing_id}), updating in place...")
            existing_post = {'id': existing_id}

    # ── Step 1: Resolve / create tags ──────────────────────────────────────────
    tag_ids = []
    if tags:
        print(f"  Resolving tags: {tags}")
        tag_ids = get_or_create_tags(tags)

    # ── Step 2: Extract excerpt ──────────────────────────────────────────────
    print("  Extracting excerpt from PDF...")
    m = re.match(r'^(\d+)-(.+)$', pdfs[0])
    chapter_title = m.group(2).replace('.pdf', '').replace('_', ' ') if m else story_name.replace('_', ' ')
    excerpt = extract_excerpt(primary_pdf)
    if not excerpt:
        excerpt = f"{story_name.replace('_', ' ')} — {chapter_title}"
    print(f"  Excerpt (first 200 chars): {excerpt[:200]}...")

    # ── Step 3: Generate + upload cover image ─────────────────────────────────
    cover_media = None
    cover_path = generate_cover(primary_pdf, OUT_DIR, story_name=story_name, excerpt=excerpt)
    if cover_path:
        print(f"  Cover saved: {cover_path}")
        print("  Uploading cover image...")
        cover_media = upload_media(str(cover_path), 'IMAGE', f"{story_name} cover", post_id=pid)
        time.sleep(0.5)
    else:
        print("  WARNING: Could not generate cover image.")

    # ── Step 4: Upload PDFs ───────────────────────────────────────────────────
    print("  Uploading PDF(s)...")
    media_ids = []
    if cover_media:
        media_ids.append(cover_media['id'])
    for pdf in pdfs:
        m2 = re.match(r'^(\d+)-(.+)$', pdf)
        pdf_title = m2.group(2).replace('.pdf', '').replace('_', ' ') if m2 else pdf.replace('.pdf', '')
        media = upload_media(os.path.join(story_dir, pdf), 'PDF', pdf_title)
        if media:
            media_ids.append(media['id'])
        time.sleep(0.5)

    # ── Step 5: Upload audio ─────────────────────────────────────────────────
    first_audio_id = None
    for aud in audio:
        aud_title = aud.replace('.m4a', '').replace('.mp3', '').replace('_', ' ')
        media = upload_media(os.path.join(story_dir, aud), 'AUDIO', aud_title)
        if media:
            media_ids.append(media['id'])
            if first_audio_id is None:
                first_audio_id = media['id']
        time.sleep(0.5)

    # ── Step 6: Create or update post ─────────────────────────────────────────
    title = story_name.replace('_', ' ').replace('-', ' ')
    pid = None
    if existing_post and not force_recreate:
        # Update in place
        patch = {
            'excerpt': excerpt,
            'featuredImageId': cover_media['id'] if cover_media else None,
            'featuredAudioId': first_audio_id,
        }
        if tag_ids:
            patch['tagIds'] = tag_ids
        ok = update_post(slug, patch)
        pid = existing_post['id']
        print(f"  {'-> Post updated' if ok else '-> Post update failed'}: {pid}")
    else:
        pid = create_post(
            title, slug, excerpt, media_ids,
            featured_image_id=cover_media['id'] if cover_media else None,
            featured_audio_id=first_audio_id,
            tag_ids=tag_ids,
        )

    if pid:
        print(f"\n  DONE: {API_BASE}/post/{slug}")
        return True
    return False

# ── CLI ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 imzadi-article-pipeline.py <story-dir> [--recreate] [--tags Tag1,Tag2,...]")
        sys.exit(1)

    story_dir = sys.argv[1]
    if not os.path.isdir(story_dir):
        print(f"Not a directory: {story_dir}")
        sys.exit(1)

    force_recreate = '--recreate' in sys.argv
    tags = None
    for arg in sys.argv:
        if arg.startswith('--tags='):
            tags = [t.strip() for t in arg.split('=', 1)[1].split(',') if t.strip()]

    success = process_article(story_dir, force_recreate=force_recreate, tags=tags)
    sys.exit(0 if success else 1)
