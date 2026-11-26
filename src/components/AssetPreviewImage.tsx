import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export interface AssetPreviewImageProps {
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
      <div className="flex h-full w-full flex-col items-center justify-center bg-surface-tertiary px-3 text-center text-text-muted">
        <ImageOff className="h-6 w-6 text-text-muted" aria-hidden="true" />
        {fallbackLabel && (
          <span className="mt-2 line-clamp-2 text-xs font-medium text-text-secondary">
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
      loading="lazy"
    />
  );
}
