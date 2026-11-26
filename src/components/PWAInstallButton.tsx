import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'full';
  onInstalled?: () => void;
}

export function PWAInstallButton({
  variant = 'header',
  onInstalled,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        onInstalled?.();
      }
      return;
    }
    setShowGuideModal(true);
  };

  const title = 'Install FolioPress on Your Device';
  const description = 'Launch full-screen from your home screen with offline access.';

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size={variant === 'full' ? 'md' : 'sm'}
      leadingIcon={<Download className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
      onClick={handleClick}
      aria-label="Install FolioPress app to home screen"
      className={variant === 'full' ? 'w-full' : 'shrink-0 whitespace-nowrap'}
    >
      {variant === 'full' ? 'Install FolioPress App' : 'Install'}
    </Button>
  );

  const guideContent = (
    <div className="space-y-4 text-xs leading-relaxed text-text-secondary">
      {isIOS ? (
        <div className="rounded-lg border border-primary-200 bg-primary-subtle p-3.5">
          <div className="flex items-center gap-2 font-semibold text-text">
            <Share className="h-4 w-4 text-primary" aria-hidden="true" />
            iPhone &amp; iPad (Safari)
          </div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            <li>
              Open this app directly in <strong>Safari</strong>.
            </li>
            <li>
              Tap the <strong>Share</strong> button in the bottom toolbar.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>, then tap{' '}
              <strong>Add</strong>.
            </li>
          </ol>
        </div>
      ) : isAndroid ? (
        <div className="rounded-lg border border-primary-200 bg-primary-subtle p-3.5">
          <div className="flex items-center gap-2 font-semibold text-text">
            <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
            Android (Chrome / Edge)
          </div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            <li>
              Open this app directly in <strong>Chrome</strong> (outside an embedded preview).
            </li>
            <li>
              Tap the <strong>⋮ Menu</strong> button in the top-right corner.
            </li>
            <li>
              Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </li>
          </ol>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface-secondary p-3.5">
            <div className="flex items-center gap-2 font-semibold text-text">
              <Share className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              iPhone / iPad (Safari)
            </div>
            <p className="mt-1">
              Open the app URL in Safari, tap <strong>Share</strong>, then tap{' '}
              <strong>Add to Home Screen</strong>.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-secondary p-3.5">
            <div className="flex items-center gap-2 font-semibold text-text">
              <Smartphone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Android &amp; Desktop (Chrome / Edge)
            </div>
            <p className="mt-1">
              Open the app URL in its own browser tab and click the{' '}
              <strong>Install</strong> icon in the address bar (or browser menu &rarr;{' '}
              <strong>Install FolioPress Studio</strong>).
            </p>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={() => setShowGuideModal(false)}
        className="w-full"
      >
        Got It
      </Button>
    </div>
  );

  return (
    <>
      {trigger}
      {showGuideModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <Modal
            open={showGuideModal}
            onClose={() => setShowGuideModal(false)}
            title={title}
            description={description}
            size="sm"
          >
            {guideContent}
          </Modal>,
          document.body
        )}
    </>
  );
}
