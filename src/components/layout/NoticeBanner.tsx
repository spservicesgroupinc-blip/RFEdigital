import { X } from 'lucide-react';
import { Button } from '../ui/Button';

export interface NoticeBannerProps {
  tone: 'info' | 'error';
  text: string;
  onDismiss?: () => void;
}

const toneClasses = {
  info: 'border-primary-200 bg-primary-subtle text-primary-900',
  error: 'border-danger-100 bg-danger-subtle text-danger-800',
};

export function NoticeBanner({ tone, text, onDismiss }: NoticeBannerProps) {
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5 lg:px-8 ${toneClasses[tone]}`}
    >
      <span className="text-xs font-medium">{text}</span>
      {onDismiss && (
        <Button variant="ghost" size="sm" onClick={onDismiss} aria-label="Dismiss notice">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
