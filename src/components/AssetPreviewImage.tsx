import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface AssetPreviewImageProps {
  src: string | null | undefined;
  alt: string;
  fallbackLabel?: string;
  className?: string;
}

export function AssetPreviewImage({
  src,
  alt,
  fallbackLabel,
  className = 'h-full w-full object-cover',
}: AssetPreviewImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 px-3 text-center text-slate-500">
        <BookOpen className="h-6 w-6 text-slate-400" aria-hidden="true" />
        {fallbackLabel && (
          <span className="mt-2 line-clamp-2 text-xs font-medium text-slate-600">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
