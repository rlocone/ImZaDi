import Link from 'next/link';
import { Heart, ArrowLeft } from 'lucide-react';

/** Sticky header for /tags and /tag/[slug]; same look as the story page header. */
export default function TagPageHeader() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-900/80 border-b border-purple-600/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
  );
}

export function TagPageFooter() {
  return (
    <footer className="mt-20 py-8 border-t border-purple-600/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
        <p>© {new Date().getFullYear()} ImZaDi. All rights reserved.</p>
      </div>
    </footer>
  );
}
