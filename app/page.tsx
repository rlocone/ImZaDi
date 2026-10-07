import { prisma } from '@/lib/db';
import { Heart, Facebook, DollarSign, AlertCircle } from 'lucide-react';
import SocialShare from '@/components/social-share';
import PostCard from '@/components/post-card';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXTAUTH_URL || 'https://imzadi.love';

async function getPosts() {
  try {
    return await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      include: { media: true, tags: { select: { id: true, name: true, slug: true } } },
    });
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return [];
  }
}

export default async function HomePage() {
  const posts = await getPosts();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-900/80 border-b border-purple-600/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-purple-500" />
              <h1 className="text-2xl font-bold text-white">ImZaDi</h1>
            </div>
            <div className="flex items-center gap-3">
              <a href="/feed" title="Subscribe via RSS" className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 transition-colors">
                <Heart className="w-5 h-5" />
              </a>
              <SocialShare url={baseUrl} title="ImZaDi - Stories That Connect" description="Explore compelling narratives about relationships, family bonds, and the beautiful complexity of human connections" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Stories That <span className="text-purple-500">Connect</span></h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">Explore compelling narratives about relationships, family bonds, and the beautiful complexity of human connections</p>
          <div className="flex justify-center">
            <a href="https://www.facebook.com/ImZaDi0" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/30 rounded-xl text-white font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105">
              <Facebook className="w-6 h-6 text-blue-400" />
              <span>Join Our Facebook Community</span>
            </a>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12"><p className="text-gray-400">No posts available yet.</p></div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>

      <section className="mt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-800/50 border border-purple-600/30 rounded-xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-purple-300 mb-4">Content & Authorship Disclaimer</h3>
              <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                <p>Some content on this site discusses themes that may be sensitive or distressing to certain readers and religious communities (including topics related to relationships, family conflict, trauma, addiction, grief, reproductive technology, and social/ethical issues). <span className="text-purple-400 font-medium">Reader discretion is advised.</span></p>
                <p>The narratives and viewpoints expressed here are my own and are shared for storytelling and discussion. They are not intended to disrespect, target, or speak on behalf of any religion, community, or individual.</p>
                <p>Some pieces were drafted or refined with the assistance of AI tools. While I review and edit the final text, AI-assisted content may include inaccuracies or unintended bias.</p>
                <p className="text-gray-400 italic">These stories are provided for creative/reflective purposes only and do not constitute medical, legal, mental health, or other professional advice.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-12 py-12 border-t border-purple-600/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center mb-8">
            <a href="https://paypal.me/rlocone" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-900/40 to-gray-900/40 border-2 border-purple-600/50 rounded-xl text-white font-semibold hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 hover:border-purple-500">
              <DollarSign className="w-6 h-6 text-purple-400" />
              <span>Support Our Stories</span>
            </a>
          </div>
          <div className="text-center text-gray-400"><p>© {new Date().getFullYear()} ImZaDi. All rights reserved.</p></div>
        </div>
      </footer>
    </div>
  );
}
