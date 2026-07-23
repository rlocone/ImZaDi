import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/media/[id]
 * Update a media item (e.g., set postId to attach it to a post)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { postId } = body;

    const updateData: Record<string, unknown> = {};
    if (postId !== undefined) updateData.postId = postId || null;

    const media = await prisma.media.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, media });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/media/[id]
 * Delete a media item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.media.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
