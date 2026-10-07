import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import TagPageHeader, { TagPageFooter } from '@/components/tag-page-header';
import { SITE_URL } from '@/lib/tag-meta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tags',
  alternates: { canonical: `${SITE_URL}/tags` },
  openGraph: { title: 'Tags | ImZaDi', url: `${SITE_URL}/tags`, siteName: 'ImZaDi', type: 'website' },
};

async function getTags() {
  try {
    const tags = await prisma.tag.findMany({
      include: { _count: { select: { posts: { where: { published: true } } } } },
    });
    return tags
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug, count: t._count.posts }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    return [];
  }
}

export default async function TagsIndexPage() {
  const tags = await getTags();
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      <TagPageHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Browse by <span className="text-purple-500">Tag</span></h1>
        </div>
        {tags.length === 0 ? (
          <div className="text-center py-12"><p className="text-gray-400">No tags yet.</p></div>
        ) : (
          <ul className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  href={`/tag/${encodeURIComponent(tag.slug)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-900/40 text-purple-200 border border-purple-700/60 hover:bg-purple-800/50 hover:border-purple-500 transition-colors"
                >
                  <span className="font-medium">{tag.name}</span>
                  <span className="text-xs text-purple-300/80">
                    {tag.count} {tag.count === 1 ? 'story' : 'stories'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <TagPageFooter />
    </div>
  );
}
