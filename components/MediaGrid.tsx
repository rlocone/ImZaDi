'use client';

import { useState, useEffect } from 'react';

interface MediaItem {
  id: string;
  type: 'PDF' | 'IMAGE' | 'AUDIO' | 'VIDEO';
  filename: string;
  url: string;
  title: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  post?: {
    id: string;
    title: string;
    slug: string;
  } | null;
}

interface MediaGridProps {
  type?: 'PDF' | 'IMAGE' | 'AUDIO' | 'VIDEO';
  postId?: string;
  onDelete?: (id: string) => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MediaIcon({ type }: { type: string }) {
  if (type === 'PDF') {
    return (
      <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/>
      </svg>
    );
  }
  if (type === 'IMAGE') {
    return (
      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === 'AUDIO') {
    return (
      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  }
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  );
}

export default function MediaGrid({ type, postId, onDelete }: MediaGridProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        if (postId) params.set('postId', postId);

        const response = await fetch(`/api/media/upload?${params}`);
        if (!response.ok) throw new Error('Failed to fetch media');

        const data = await response.json();
        setMedia(data.media);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load media');
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [type, postId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this file?')) return;

    try {
      const response = await fetch(`/api/media/upload?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== id));
        onDelete?.(id);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-center py-8 bg-red-500/10 border border-red-500/30 rounded">
        {error}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="text-gray-400 text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
        No media files yet. Upload something to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {media.map((item) => (
        <div
          key={item.id}
          className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
        >
          <div className="flex items-start gap-3">
            <MediaIcon type={item.type} />
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium truncate" title={item.filename}>
                {item.title || item.filename}
              </h4>
              <p className="text-sm text-gray-400">{formatFileSize(item.size)}</p>
              <p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p>
            </div>
            <button
              onClick={() => handleDelete(item.id)}
              className="text-gray-500 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {item.type === 'IMAGE' && (
            <div className="mt-3">
              <img
                src={item.url || `/api/media/${item.url}`}
                alt={item.title || item.filename}
                className="w-full h-32 object-cover rounded"
              />
            </div>
          )}

          {item.type === 'AUDIO' && (
            <div className="mt-3">
              <audio controls className="w-full">
                <source src={item.url} type={item.mimeType || 'audio/mpeg'} />
              </audio>
            </div>
          )}

          {item.type === 'PDF' && (
            <div className="mt-3">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open PDF
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
