import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      include: {
        tags: { select: { name: true } },
        media: { where: { type: 'IMAGE' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'https://imzadi.love';

    const items = posts
      .map((post) => {
        const imageUrl = post.media[0]?.url || '';
        const categories = post.tags.map((t) => t.name).join(', ');

        return `
    <entry>
      <id>${baseUrl}/post/${post.slug}</id>
      <title>${escapeXml(post.title)}</title>
      <link href="${baseUrl}/post/${post.slug}"/>
      <updated>${post.updatedAt.toISOString()}</updated>
      <published>${post.createdAt.toISOString()}</published>
      <author><name>${escapeXml(post.author || 'Gloria')}</name></author>
      <summary type="html">${escapeXml(post.excerpt?.substring(0, 500) || '')}</summary>
      ${imageUrl ? `<media:content url="${escapeXml(imageUrl)}" medium="image"/>` : ''}
      ${categories ? categories.split(', ').map((c) => `<category term="${escapeXml(c)}"/>`).join('\n      ') : ''}
    </entry>`;
      })
      .join('\n');

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:media="http://search.yahoo.com/mrss/"
      xml:lang="en">
  <id>${baseUrl}/</id>
  <title>ImZaDi - Stories That Connect</title>
  <subtitle>Explore compelling narratives about relationships, family bonds, and the beautiful complexity of human connections</subtitle>
  <link href="${baseUrl}/feed" rel="self"/>
  <link href="${baseUrl}/" rel="alternate"/>
  <updated>${posts[0]?.updatedAt?.toISOString() || new Date().toISOString()}</updated>
  <author><name>Gloria</name></author>
  <rights>© ${new Date().getFullYear()} ImZaDi. All rights reserved.</rights>
  <icon>${baseUrl}/favicon.ico</icon>
${items}
</feed>`;

    return new NextResponse(feed, {
      headers: {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Failed to generate feed:', error);
    return new NextResponse('Feed generation failed', { status: 500 });
  }
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}