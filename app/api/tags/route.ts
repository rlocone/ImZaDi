import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/tags
 * List all tags, optionally filtered by name search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const where = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    const tags = await prisma.tag.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });

    return NextResponse.json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        postCount: t._count.posts,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/tags
 * Create one or more new tags
 * Body: { name: string } or { names: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, names } = body;

    const toCreate = names
      ? names.map((n: string) => ({ name: n.trim(), slug: n.trim().toLowerCase().replace(/\s+/g, '-') }))
      : [{ name: name.trim(), slug: name.trim().toLowerCase().replace(/\s+/g, '-') }];

    // Upsert each tag (ignore duplicates)
    const results = await Promise.all(
      toCreate.map((data) =>
        prisma.tag.upsert({
          where: { slug: data.slug },
          update: {},
          create: data,
        })
      )
    );

    return NextResponse.json({
      success: true,
      tags: results.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
