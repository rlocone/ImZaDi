import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/posts
 * Create a new blog post with optional media attachments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      slug,
      excerpt,
      content,
      author,
      mediaIds = [],
      featuredImageId,
      featuredAudioId,
      published = true,
      tagIds = [],
      tags = [],
    } = body;

    // Validate required fields
    if (!title || !slug) {
      return NextResponse.json(
        { error: 'Title and slug are required' },
        { status: 400 }
      );
    }

    // Upsert any new tags
    if (tags.length > 0) {
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

    // Create post with media and tag connections
    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt: excerpt || null,
        content: content || null,
        author: author || null,
        published,
        featuredAudioId: featuredAudioId || null,
        featuredImageId: featuredImageId || null,
        media: {
          connect: mediaIds.map((id: string) => ({ id })),
        },
        tags: {
          connect: tagIds.map((id: string) => ({ id })),
        },
      },
      include: {
        media: true,
        tags: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        featuredAudioId: post.featuredAudioId,
        featuredImageId: post.featuredImageId,
        media: post.media.map((m) => ({
          id: m.id,
          type: m.type,
          url: m.url,
          title: m.title,
        })),
        tags: post.tags,
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error('Post creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create post', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posts
 * List blog posts with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const published = searchParams.get('published');
    const slug = searchParams.get('slug');

    const where: Record<string, unknown> = {};
    if (published !== null) {
      where.published = published === 'true';
    }
    if (slug) {
      where.slug = slug;
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          media: true,
          tags: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    const postsWithFeatured = posts.map((p) => ({
      ...p,
      featuredAudioId: p.featuredAudioId,
      featuredImageId: p.featuredImageId,
    }));

    return NextResponse.json({
      posts: postsWithFeatured,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + posts.length < total,
      },
    });
  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json(
      { error: 'Failed to list posts' },
      { status: 500 }
    );
  }
}
