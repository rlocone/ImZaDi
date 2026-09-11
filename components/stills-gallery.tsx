"use client";

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

export type GalleryImage = {
  id: string;
  url: string;
  title?: string | null;
};

interface StillsGalleryProps {
  stills: GalleryImage[];
  storyTitle: string;
  /** Optional featured/hero image shown above the stills grid; clickable into the same lightbox. */
  featured?: GalleryImage | null;
  /** Content rendered between featured hero and stills (e.g. audio player) to preserve layout order. */
  afterFeatured?: ReactNode;
}

export default function StillsGallery({ stills, storyTitle, featured, afterFeatured }: StillsGalleryProps) {
  // Lightbox index into `all` (featured first when present, then stills).
  const all: GalleryImage[] = [
    ...(featured ? [featured] : []),
    ...stills,
  ];
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null;
  const current = openIndex !== null ? all[openIndex] : null;

  const close = useCallback(() => setOpenIndex(null), []);
  const prev = useCallback(() => {
    setOpenIndex((i) => (i === null || all.length === 0 ? i : (i - 1 + all.length) % all.length));
  }, [all.length]);
  const next = useCallback(() => {
    setOpenIndex((i) => (i === null || all.length === 0 ? i : (i + 1) % all.length));
  }, [all.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close, prev, next]);

  const featuredOffset = featured ? 1 : 0;

  return (
    <>
      {featured && (
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          className="group relative aspect-video w-full bg-gray-900 mb-10 rounded-lg overflow-hidden border border-transparent hover:border-purple-600/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          aria-label={`View full-size cover for ${storyTitle}`}
        >
          <Image
            src={featured.url}
            alt={storyTitle}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          />
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-gray-900/70 px-2 py-1 text-xs text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity border border-purple-600/40">
            <ZoomIn className="w-3.5 h-3.5" />
            Expand
          </span>
        </button>
      )}

      {afterFeatured}

      {stills.length > 0 && (
        <section className="mb-10" aria-label="Story stills">
          <div className="flex items-center gap-2 text-purple-400 mb-4">
            <h2 className="text-lg font-semibold">Stills</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stills.map((still, i) => (
              <button
                type="button"
                key={still.id}
                onClick={() => setOpenIndex(featuredOffset + i)}
                className="group relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-600/50 transition-colors shadow-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                aria-label={`View full-size: ${still.title || storyTitle + ' still'}`}
              >
                <Image
                  src={still.url}
                  alt={still.title || `${storyTitle} still`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"
                />
                {still.title && (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-900/90 via-gray-900/50 to-transparent px-3 py-2 text-xs text-gray-300">
                    {still.title}
                  </span>
                )}
                <span className="pointer-events-none absolute top-2 right-2 inline-flex items-center rounded-md bg-gray-900/70 p-1.5 text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity border border-purple-600/40">
                  <ZoomIn className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {open && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.title || storyTitle}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-8"
          onClick={close}
        >
          <div
            className="relative max-w-6xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              className="absolute -top-2 -right-2 sm:top-0 sm:right-0 z-10 rounded-full bg-gray-900/90 border border-purple-600/50 p-2 text-purple-300 hover:text-white hover:border-purple-400 transition-colors"
              aria-label="Close lightbox"
            >
              <X className="w-5 h-5" />
            </button>

            {all.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-gray-900/90 border border-purple-600/50 p-2 text-purple-300 hover:text-white hover:border-purple-400 transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-gray-900/90 border border-purple-600/50 p-2 text-purple-300 hover:text-white hover:border-purple-400 transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <div className="relative w-full flex items-center justify-center overflow-hidden rounded-lg border border-purple-600/40 bg-gray-950 shadow-2xl shadow-purple-900/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={current.title || storyTitle}
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-gray-300">
              {current.title && <span className="text-purple-300">{current.title}</span>}
              {all.length > 1 && (
                <span className="text-gray-500">
                  {(openIndex ?? 0) + 1} / {all.length}
                </span>
              )}
              <span className="hidden sm:inline text-gray-500">Esc to close · ← → to browse</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
