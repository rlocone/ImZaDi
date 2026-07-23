"use client";

import { Share2, Facebook, Twitter, Linkedin, Link2, Check } from 'lucide-react';
import { useState } from 'react';

interface SocialShareProps {
  url: string;
  title: string;
  description: string;
}

export default function SocialShare({ url, title, description }: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (navigator.share) {
            navigator.share({ url, title, text: description });
          }
        }}
        className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 transition-colors"
        aria-label="Share this story"
      >
        <Share2 className="w-5 h-5" />
      </button>

      <div className="absolute right-0 top-full mt-2 py-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <Facebook className="w-4 h-4" />
          <span>Facebook</span>
        </a>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <Twitter className="w-4 h-4" />
          <span>Twitter</span>
        </a>
        <a
          href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <Linkedin className="w-4 h-4" />
          <span>LinkedIn</span>
        </a>
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
          <span>{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>
      </div>
    </div>
  );
}
