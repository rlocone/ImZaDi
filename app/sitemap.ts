import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { SITE_URL } from '@/lib/tag-meta';

// public/robots.txt already advertises /sitemap.xml, which 404s today.
// Built per request from the DB, like the rest of the site.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [posts, tags] = await Promise.all([
      prisma.blogPost.findMany({
        where: { published: true },
        select: { slug: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tag.findMany({
        select: { slug: true, _count: { select: { posts: { where: { published: true } } } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return [
      { url: `${SITE_URL}/` },
      { url: `${SITE_URL}/tags` },
      ...tags.filter((t) => t._count.posts > 0).map((t) => ({ url: `${SITE_URL}/tag/${encodeURIComponent(t.slug)}` })),
      ...posts.map((p) => ({ url: `${SITE_URL}/post/${p.slug}`, lastModified: p.updatedAt })),
    ];
  } catch (error) {
    console.error('Failed to build sitemap:', error);
    return [{ url: `${SITE_URL}/` }, { url: `${SITE_URL}/tags` }];
  }
}
