'use client';

import { useState } from 'react';

interface UploadResult {
  id: string;
  type: string;
  filename: string;
  url: string;
  title: string | null;
  size: number;
}

interface MediaUploaderProps {
  postId?: string;
  onUploadComplete?: (media: UploadResult) => void;
}

export default function MediaUploader({ postId, onUploadComplete }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      // Determine type from MIME
      let type = 'IMAGE';
      if (file.type.startsWith('application/pdf')) type = 'PDF';
      else if (file.type.startsWith('audio/')) type = 'AUDIO';
      else if (file.type.startsWith('video/')) type = 'VIDEO';

      formData.append('type', type);
      if (postId) formData.append('postId', postId);

      try {
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        const data = await response.json();
        onUploadComplete?.(data.media);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    setUploading(false);
    setProgress(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragging
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.wav,.ogg"
          onChange={(e) => handleUpload(e.target.files)}
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-gray-300">
            {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
          </span>
          <span className="text-sm text-gray-500">
            PDF, Images (JPG, PNG, GIF, WebP), Audio (MP3, WAV)
          </span>
        </label>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-3">
          {error}
        </div>
      )}

      {uploading && (
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
