import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Heart, ArrowLeft, Headphones } from 'lucide-react';
import { format } from 'date-fns';
import AudioPlayer from '@/components/audio-player';
import SocialShare from '@/components/social-share';
import PdfList from '@/components/pdf-list';
import StillsGallery from '@/components/stills-gallery';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXTAUTH_URL || 'https://imzadi.love';

async function getPost(slug: string) {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: { media: true, tags: { select: { id: true, name: true, slug: true } } },
    });
    if (!post) return null;
    return {
      ...post,
      featuredAudioId: post.featuredAudioId,
      featuredImageId: post.featuredImageId,
    };
  } catch (error) {
    console.error('Failed to fetch post:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: 'Post Not Found' };

  const excerpt = post.excerpt.substring(0, 200).trim() + '...';
  const imageUrl = post.featuredImageId
    ? post.media.find((m: any) => m.id === post.featuredImageId)?.url
    : post.media.find((m: any) => m.type === 'IMAGE')?.url || '/og-image.png';

  return {
    title: post.title,
    description: excerpt,
    openGraph: {
      title: post.title,
      description: excerpt,
      url: `${baseUrl}/post/${params.slug}`,
      siteName: 'ImZaDi',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: post.title }],
      locale: 'en_US',
      type: 'article',
      publishedTime: post.createdAt.toISOString(),
    },
    twitter: { card: 'summary_large_image', title: post.title, description: excerpt, images: [imageUrl] },
  };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  // Use explicit featured ID if set, otherwise fall back to first matching media
  const featuredAudio = post.featuredAudioId
    ? post.media.find((m: any) => m.id === post.featuredAudioId)
    : post.media.find((m: any) => m.type === 'AUDIO' || m.type === 'VIDEO');
  const featuredImage = post.featuredImageId
    ? post.media.find((m: any) => m.id === post.featuredImageId)
    : post.media.find((m: any) => m.type === 'IMAGE');
  const pdfFiles = post.media.filter((m: any) => m.type === 'PDF').map((m: any) => ({
    title: m.title || 'PDF Document',
    fileName: m.url.split('/').pop() || 'document.pdf',
    description: m.metadata?.description || '',
  }));

  // Remaining IMAGE media for the stills gallery (exclude featured so it is not duplicated).
  const stills = post.media.filter(
    (m: any) =>
      m.type === 'IMAGE' &&
      m.id !== post.featuredImageId &&
      // If featuredImageId is unset, featuredImage falls back to the first IMAGE —
      // still exclude that one so the hero is not repeated.
      (!featuredImage || m.id !== featuredImage.id) &&
      m.url
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-900/80 border-b border-purple-600/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gray-300 hover:text-purple-400 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </Link>
            <div className="flex items-center gap-3">
              <a href="/feed" title="Subscribe via RSS" className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 transition-colors">
                <Heart className="w-4 h-4" />
              </a>
              <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-purple-500" />
                <span className="font-semibold text-white">ImZaDi</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-8 sm:p-12">
          <div className="mb-8">
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
              <time dateTime={post.createdAt.toISOString()}>{format(new Date(post.createdAt), 'MMMM d, yyyy \'at\' h:mm a')}</time>
              {post.author && (
                <span className="text-purple-400">Posted by {post.author}</span>
              )}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">{post.title}</h1>
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag: { id: string; name: string; slug: string }) => (
                  <span
                    key={tag.id}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-purple-900/50 text-purple-300 border border-purple-700"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {(featuredImage || stills.length > 0) ? (
            <StillsGallery
              featured={
                featuredImage
                  ? { id: featuredImage.id, url: featuredImage.url, title: featuredImage.title || post.title }
                  : null
              }
              stills={stills.map((still: any) => ({
                id: still.id,
                url: still.url,
                title: still.title,
              }))}
              storyTitle={post.title}
              afterFeatured={
                featuredAudio ? (
                  <div className="mb-10">
                    <div className="flex items-center gap-2 text-purple-400 mb-4">
                      <Headphones className="w-5 h-5" />
                      <h2 className="text-lg font-semibold">Listen to this story</h2>
                    </div>
                    <AudioPlayer src={featuredAudio.url} type={featuredAudio.type.toLowerCase()} />
                  </div>
                ) : null
              }
            />
          ) : (
            featuredAudio ? (
              <div className="mb-10">
                <div className="flex items-center gap-2 text-purple-400 mb-4">
                  <Headphones className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Listen to this story</h2>
                </div>
                <AudioPlayer src={featuredAudio.url} type={featuredAudio.type.toLowerCase()} />
              </div>
            ) : null
          )}

          <div className="prose prose-lg max-w-none">
            <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">{post.excerpt}</div>
          </div>

          {pdfFiles.length > 0 && <PdfList pdfFiles={pdfFiles} />}
        </article>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-300 hover:text-purple-400 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to all stories</span>
          </Link>
          <SocialShare url={`${baseUrl}/post/${params.slug}`} title={post.title} description={post.excerpt.substring(0, 200)} />
        </div>
      </main>

      <footer className="mt-20 py-8 border-t border-purple-600/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>© {new Date().getFullYear()} ImZaDi. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
