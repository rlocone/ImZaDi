import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import PostCard from '@/components/post-card';
import TagPageHeader, { TagPageFooter } from '@/components/tag-page-header';
import { SITE_URL, tagDescription } from '@/lib/tag-meta';

export const dynamic = 'force-dynamic';

async function getTag(slug: string) {
  try {
    return await prisma.tag.findUnique({
      where: { slug: decodeURIComponent(slug) },
      include: {
        posts: {
          where: { published: true },
          orderBy: { createdAt: 'desc' },
          include: { media: true, tags: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch tag:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tag = await getTag(params.slug);
  if (!tag || tag.posts.length === 0) return { title: 'Tag Not Found' };
  const description = tagDescription(tag.name);
  const url = `${SITE_URL}/tag/${tag.slug}`;
  return {
    title: tag.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${tag.name} | ImZaDi`, description, url, siteName: 'ImZaDi', type: 'website', locale: 'en_US' },
    twitter: { card: 'summary', title: `${tag.name} | ImZaDi`, description },
  };
}

export default async function TagPage({ params }: { params: { slug: string } }) {
  const tag = await getTag(params.slug);
  if (!tag || tag.posts.length === 0) notFound();
  const count = tag.posts.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      <TagPageHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-wider text-purple-400 mb-2">
            <Link href="/tags" className="hover:text-purple-300 transition-colors">Tags</Link>
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">{tag.name}</h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-2">{tagDescription(tag.name)}</p>
          <p className="text-sm text-gray-400">{count} {count === 1 ? 'story' : 'stories'}</p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {tag.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/tags" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">See all tags</Link>
        </div>
      </main>
      <TagPageFooter />
    </div>
  );
}
