import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/posts/[slug]
 * Fetch a post by slug
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: params.slug },
      include: {
        media: true,
        tags: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, post });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/posts/[slug]
 * Delete a post by slug
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await prisma.blogPost.delete({ where: { slug: params.slug } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * PATCH /api/posts/[slug]
 * Update an existing blog post — used to set featuredAudioId, featuredImageId, etc.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();

    // Fields that are allowed to be updated
    const {
      title,
      excerpt,
      content,
      author,
      featured,
      published,
      featuredAudioId,
      featuredImageId,
      tagIds,
      tags,
    } = body;

    // Upsert any new tags
    if (tags && tags.length > 0) {
      await Promise.all(
        tags.map((name: string) =>
          prisma.tag.upsert({
            where: { slug: name.trim().toLowerCase().replace(/\s+/g, '-') },
            update: {},
            create: {
              name: name.trim(),
              slug: name.trim().toLowerCase().replace(/\s+/g, '-'),
            },
          })
        )
      );
    }

    // Build update data — only include fields that are explicitly provided
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (author !== undefined) updateData.author = author;
    if (featured !== undefined) updateData.featured = featured;
    if (published !== undefined) updateData.published = published;
    if (featuredAudioId !== undefined) updateData.featuredAudioId = featuredAudioId || null;
    if (featuredImageId !== undefined) updateData.featuredImageId = featuredImageId || null;
    if (tagIds !== undefined) {
      updateData.tags = { set: tagIds.map((id: string) => ({ id })) };
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const post = await prisma.blogPost.update({
      where: { slug },
      data: updateData,
      include: {
        media: true,
        tags: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({ success: true, post });
  } catch (error: unknown) {
    console.error('Post update error:', error);
    const err = error as { code?: string; meta?: { target?: string[] } };
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update post', details: String(error) },
      { status: 500 }
    );
  }
}
