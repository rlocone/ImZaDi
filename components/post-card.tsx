import Link from 'next/link';
import Image from 'next/image';
import { Clock, ArrowRight, FileText, Headphones } from 'lucide-react';
import { format } from 'date-fns';

type CardTag = { id: string; name: string; slug: string };
type CardMedia = { id: string; type: string; url: string | null };
export type CardPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  createdAt: Date;
  featuredImageId: string | null;
  media: CardMedia[];
  tags: CardTag[];
};

/**
 * Story card used on the home page and on tag pages.
 * Markup is unchanged from the original inline home-page card (moved here so tag
 * pages render identical cards). Chips stay plain <span>s because the whole card
 * is already a link, and nested <a> elements are invalid HTML.
 */
export default function PostCard({ post }: { post: CardPost }) {
  const featuredImage = post.featuredImageId
    ? post.media.find((m: any) => m.id === post.featuredImageId)
    : post.media.find((m: any) => m.type === 'IMAGE');
  const hasAudio = post.media.some((m: any) => m.type === 'AUDIO' || m.type === 'VIDEO');
  const hasPdf = post.media.some((m: any) => m.type === 'PDF');
  return (
    <Link href={`/post/${post.slug}`} className="group block">
      <article className="h-full bg-gray-800 rounded-lg shadow-md hover:shadow-purple-500/30 hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-700 hover:border-purple-500/50">
        {featuredImage && (
          <div className="relative aspect-video bg-gray-900">
            <Image src={featuredImage.url as string} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Clock className="w-4 h-4" />
            <time dateTime={post.createdAt.toISOString()}>{format(new Date(post.createdAt), 'MMM d, yyyy')}</time>
            {hasAudio && <Headphones className="w-4 h-4 ml-2 text-purple-400" />}
            {hasPdf && <FileText className="w-4 h-4 text-purple-400" />}
          </div>
          <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">{post.title}</h3>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {post.tags.slice(0, 3).map((tag: CardTag) => (
                <span key={tag.id} className="px-2 py-0.5 text-xs rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/50">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          <p className="text-gray-300 mb-4 line-clamp-3">{post.excerpt.substring(0, 150)}...</p>
          <div className="flex items-center gap-2 text-purple-500 font-medium">
            <span>Read More</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </article>
    </Link>
  );
}
