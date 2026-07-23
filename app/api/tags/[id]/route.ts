import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/tags/[id]
 * Update a tag's name
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { name } = await request.json();
    const tag = await prisma.tag.update({
      where: { id },
      data: {
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/\s+/g, '-'),
      },
    });
    return NextResponse.json({ success: true, tag });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/tags/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.tag.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
